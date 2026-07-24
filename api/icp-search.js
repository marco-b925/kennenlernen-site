const https = require('https');
const http = require('http');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat-v3-0324:free';
const MAX_SEARCHES = 10;
const WINDOW_MS = 60 * 60 * 1000;

const rateMap = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now - entry.reset > WINDOW_MS) {
    rateMap.set(ip, { count: 1, reset: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_SEARCHES - 1 };
  }
  if (entry.count >= MAX_SEARCHES) return { allowed: false, remaining: 0 };
  entry.count++;
  return { allowed: true, remaining: MAX_SEARCHES - entry.count };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded', limit: MAX_SEARCHES, remaining: 0 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const company = body.company?.trim();
  if (!company) return res.status(400).json({ error: 'company required' });
  if (company.length > 80) return res.status(400).json({ error: 'company name too long' });

  try {
    const domain = await findDomain(company);
    let scraped = '';

    if (domain) {
      const pages = await crawlPages(domain);
      scraped = pages.map(p => `[${p.label}] ${p.url}\n${p.text}`).join('\n\n===\n\n');
    }

    const result = await analyzeWithLLM(company, domain, scraped, apiKey);

    return res.json({
      ...result,
      domain,
      sourceUrls: domain ? [`https://${domain}`] : [],
      _remaining: rateCheck.remaining
    });
  } catch (err) {
    console.error('ICP search error:', err);
    return res.status(500).json({ error: 'Internal error', detail: err.message });
  }
};

function fetchUrl(url, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const req = proto.get(url, { timeout: timeoutMs }, (resp) => {
      let data = '';
      resp.on('data', c => data += c);
      resp.on('end', () => resolve({ status: resp.statusCode, data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function findDomain(name) {
  let slug = name.toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '')
    .replace(/[^a-z0-9\u00e4\u00f6\u00fc\u00df.-]/g, '')
    .replace(/\.(com|de|eu|net|org|io|app|gmbh|at|ch)$/i, '');

  if (!slug || slug.length < 2) return null;
  if (slug.includes('.')) return slug;

  const results = await Promise.allSettled(
    ['.de', '.com', '.eu', '.net', '.org', '.io', '.app'].map(async (tld) => {
      try {
        const r = await fetchUrl(`https://${slug}${tld}`, 2500);
        if (r.status >= 200 && r.status < 400) return `${slug}${tld}`;
      } catch {}
      return null;
    })
  );
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) return r.value;
  }
  return null;
}

function stripHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function crawlPages(domain) {
  const paths = ['/', '/impressum', '/karriere', '/unternehmen', '/team'];
  const results = await Promise.allSettled(
    paths.map(async (path) => {
      const url = `https://${domain}${path}`;
      try {
        const resp = await fetchUrl(url, 4000);
        if (resp.status >= 200 && resp.status < 400 && resp.data.length > 200) {
          const text = stripHtml(resp.data).slice(0, 4000);
          const label = path === '/' ? 'Homepage' : path.replace('/', '');
          return { url, text, label };
        }
      } catch {}
      return null;
    })
  );
  return results
    .filter(r => r.status === 'fulfilled' && r.value && r.value.text.length > 50)
    .map(r => r.value);
}

async function analyzeWithLLM(name, domain, scraped, apiKey) {
  const systemPrompt =
    'Du analysierst Firmen für B2B-Lead-Bewertung. ' +
    'Du bekommst Firmenname + ggf. gescrapte Website-Inhalte. ' +
    'Gib NUR ein JSON-Objekt zurück, keine Erklärungen.\n\n' +
    'Felder:\n' +
    '- company_name: vollständiger Firmenname\n' +
    '- industry: Branche (deutsch)\n' +
    '- hq: Hauptsitz (Stadt, Land)\n' +
    '- employees: Mitarbeiter (String, z.B. "~250")\n' +
    '- revenue: Umsatz (String, z.B. "50 Mio. €")\n' +
    '- jobs_open: geschätzte offene Stellen (String)\n' +
    '- icp_score: Zahl 1-10\n' +
    '- icp_rationale: 1 Satz Begründung\n' +
    '- pain_point: wahrscheinlichster Recruiting-Schmerzpunkt\n' +
    '- outreach: personalisierte Kaltkontakt-Nachricht (Deutsch, per Du, max 3 Sätze)\n' +
    '- apprenticeships: Ausbildungsberufe-Infos oder "—"';

  const isp = scraped
    ? `Gescrapte Inhalte von ${domain}:\n${scraped}`
    : 'Keine Website gefunden. Nutze dein Wissen.';

  const userPrompt = `Firma: ${name}\n\n${isp}\n\nJSON:`;

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'https://marcogrotemeyer.de',
      'X-Title': 'ICP Search',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      temperature: 0.1,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => 'Unknown');
    throw new Error(`OpenRouter ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  return parseLLMResponse(content, name);
}

function parseLLMResponse(content, fallbackName) {
  let json = null;
  const match = content.match(/\{[\s\S]*\}/);
  if (match) {
    try { json = JSON.parse(match[0]); } catch {}
  }
  if (!json) try { json = JSON.parse(content); } catch {}
  if (!json || typeof json !== 'object') {
    return {
      company_name: fallbackName, industry: 'Unbekannt', hq: '—',
      employees: '—', revenue: '—', jobs_open: '—',
      icp_score: 0, icp_rationale: 'LLM-Antwort nicht lesbar',
      pain_point: '—', outreach: null, apprenticeships: ''
    };
  }
  return {
    company_name: json.company_name || fallbackName,
    industry: json.industry || 'Unbekannt',
    hq: json.hq || '—',
    employees: json.employees || '—',
    revenue: json.revenue || '—',
    jobs_open: json.jobs_open || '—',
    icp_score: typeof json.icp_score === 'number' ? Math.max(0, Math.min(10, json.icp_score)) : 0,
    icp_rationale: json.icp_rationale || '',
    pain_point: json.pain_point || '—',
    outreach: json.outreach || null,
    apprenticeships: json.apprenticeships || ''
  };
}
