import crypto from "crypto";

// Password hashes per company. Set via Vercel env: COMPANY_PASSWORDS={"hr-tech":"<hash>","neurawork":"<hash>"}
function getCompanyHashes() {
  try {
    const raw = process.env.COMPANY_PASSWORDS;
    if (!raw) return { missing: true };
    const parsed = JSON.parse(raw.trim());
    if (typeof parsed !== "object" || !parsed) return { invalid: true, raw: raw.substring(0, 60) };
    // Trim all hash values (env vars can pick up stray newlines)
    for (const key of Object.keys(parsed)) {
      if (typeof parsed[key] === "string") parsed[key] = parsed[key].trim();
    }
    return parsed;
  } catch (e) {
    return { error: e.message, raw: (process.env.COMPANY_PASSWORDS || "").substring(0, 60) };
  }
}

function sha256(plain) {
  return crypto.createHash("sha256").update(plain).digest("hex");
}

// POST /api/verify-password { company: "hr-tech", password: "plaintext" }
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  const { company, password } = body || {};
  if (!company || !password) {
    return res.status(400).json({ error: "company and password required" });
  }

  const hashes = getCompanyHashes();
  if (hashes.error || hashes.missing || hashes.invalid) {
    console.error("COMPANY_PASSWORDS parse issue:", JSON.stringify(hashes));
    return res.status(500).json({ error: "Server config error" });
  }
  if (!hashes[company]) {
    return res.status(401).json({ error: "Invalid company" });
  }

  const enteredHash = sha256(password);
  if (enteredHash !== hashes[company]) {
    return res.status(401).json({ error: "Invalid password" });
  }

  return res.status(200).json({ ok: true });
}
