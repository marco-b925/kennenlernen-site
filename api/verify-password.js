import crypto from "crypto";

// Password hashes per company. Set via Vercel env: COMPANY_PASSWORDS={"hr-tech":"<hash>","neurawork":"<hash>"}
function getCompanyHashes() {
  try {
    const raw = process.env.COMPANY_PASSWORDS;
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    console.error("Invalid COMPANY_PASSWORDS JSON");
    return null;
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
  if (!hashes || !hashes[company]) {
    return res.status(401).json({ error: "Invalid company" });
  }

  const enteredHash = sha256(password);
  if (enteredHash !== hashes[company]) {
    return res.status(401).json({ error: "Invalid password" });
  }

  return res.status(200).json({ ok: true });
}
