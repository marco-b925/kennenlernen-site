// Marco Chat Proxy — OpenRouter (OpenAI-compatible, streaming)
// POST /api/chat — expects { messages: [{role: "user"|"assistant", content: "text"}] }
// Model: MiniMax M3 via OpenRouter + auto-loaded knowledge files

import fs from "fs";
import path from "path";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "minimax/minimax-m3";

// In-memory knowledge cache (persists across warm invocations)
let knowledgeCache = null;
let knowledgeCacheTimestamp = 0;

function loadKnowledge(knowledgeDir) {
  const now = Date.now();
  if (knowledgeCache && now - knowledgeCacheTimestamp < 60_000) {
    return knowledgeCache;
  }

  const parts = [];
  const basePath = path.join(process.cwd(), knowledgeDir);

  if (!fs.existsSync(basePath)) {
    console.log("knowledge/ directory not found, skipping");
    knowledgeCache = "";
    knowledgeCacheTimestamp = now;
    return "";
  }

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        try {
          const content = fs.readFileSync(full, "utf-8").trim();
          if (content) {
            parts.push(content);
          }
        } catch (err) {
          console.error(`Failed to read ${full}:`, err.message);
        }
      }
    }
  }

  walk(basePath);

  const assembled = parts.join("\n\n---\n\n");
  const estimatedTokens = Math.round(assembled.length / 3.5);
  console.log(
    `Loaded ${parts.length} knowledge files (~${estimatedTokens} tokens estimated)`
  );

  knowledgeCache = assembled;
  knowledgeCacheTimestamp = now;
  return assembled;
}

function buildSystemPrompt() {
  const personaPrompt = process.env.MARCO_SYSTEM_PROMPT;
  if (!personaPrompt) {
    console.error("Missing MARCO_SYSTEM_PROMPT env var");
    return "System prompt not configured. Set MARCO_SYSTEM_PROMPT in Vercel.";
  }

  const knowledge = loadKnowledge("knowledge");
  if (knowledge) {
    return (
      personaPrompt +
      "\n\n## Verfuegbare Wissensbasis\n" +
      "Nutze die folgenden Informationen, wenn sie fuer die Beantwortung relevant sind:\n\n" +
      knowledge
    );
  }

  return personaPrompt;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("Missing OPENROUTER_API_KEY env var");
    return res.status(500).json({ error: "API key not configured" });
  }

  let messages;
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    messages = body.messages;
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array required" });
  }

  const sanitized = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: String(m.content || "") }));

  if (sanitized.length === 0) {
    return res.status(400).json({ error: "No valid messages" });
  }

  const systemPrompt = buildSystemPrompt();
  const fullMessages = [
    { role: "system", content: systemPrompt },
    ...sanitized,
  ];

  try {
    const upstream = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "https://marcogrotemeyer.de",
        "X-Title": "Marco kennenlernen",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        temperature: 1,
        messages: fullMessages,
        stream: true,
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error("OpenRouter error:", upstream.status, errText);
      return res
        .status(502)
        .json({ error: "Upstream API error", detail: errText.substring(0, 500) });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const decoder = new TextDecoder();
    const reader = upstream.body.getReader();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
          }
        } catch {
          // skip
        }
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Chat proxy error:", err);
    if (!res.writableEnded) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}