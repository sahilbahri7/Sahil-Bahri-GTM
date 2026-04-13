// AI proxy — uses Groq (free tier, fast Llama 3 inference)
// Get a free API key at: https://console.groq.com
// Add GROQ_API_KEY to Vercel environment variables

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { prompt, system } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GROQ_API_KEY not set in Vercel env vars — get a free key at console.groq.com" });

  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 1024,
        messages: [
          { role: "system", content: system || "You are a helpful assistant." },
          { role: "user", content: prompt },
        ],
      }),
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || "Groq API error" });
    return res.status(200).json({ text: data.choices?.[0]?.message?.content || "" });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Unexpected error" });
  }
}
