import crypto from "crypto";

const SECRET = process.env.MAGIC_SECRET || "dev-fallback-change-in-prod";

function verifyToken(token) {
  try {
    const dotIndex = token.lastIndexOf(".");
    if (dotIndex === -1) return null;

    const payload = token.slice(0, dotIndex);
    const sig = token.slice(dotIndex + 1);

    // Verify signature
    const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
    if (expected !== sig) return null;

    // Decode payload
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

    // Check expiry
    if (!data.exp || Date.now() > data.exp) return null;

    return data;
  } catch {
    return null;
  }
}

export default function handler(req, res) {
  const token = req.method === "GET" ? req.query.token : req.body?.token;

  if (!token) {
    return res.status(400).json({ error: "Missing token" });
  }

  const data = verifyToken(token);

  if (!data || !data.email) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  return res.status(200).json({ email: data.email });
}
