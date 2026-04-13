// AI proxy — uses Google Gemini (free tier via AI Studio)
// Key stored in Vercel env var: Revosys_Gemini

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { prompt, system } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  const apiKey = process.env.Revosys_Gemini;
  if (!apiKey) return res.status(500).json({ error: "Revosys_Gemini not set in Vercel env vars" });

  try {
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

    const body = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1024 },
    };

    if (system) {
      body.systemInstruction = { parts: [{ text: system }] };
    }

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || "Gemini API error" });

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Unexpected error" });
  }
}
