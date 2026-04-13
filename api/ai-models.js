// Diagnostic endpoint — lists all Gemini models available for your API key
// Visit: https://revosys.pro/api/ai-models
export default async function handler(req, res) {
  const apiKey = process.env.Revosys_Gemini;
  if (!apiKey) return res.status(500).json({ error: "Revosys_Gemini not set" });

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);

    // Return just the model names and supported methods for readability
    const models = (data.models || []).map(m => ({
      name: m.name,
      displayName: m.displayName,
      supportedMethods: m.supportedGenerationMethods,
    }));
    return res.status(200).json({ count: models.length, models });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
