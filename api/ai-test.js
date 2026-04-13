// Diagnostic: tests the Groq key and returns detailed status
// Visit: https://revosys.pro/api/ai-test
export default async function handler(req, res) {
  const apiKey = process.env.RevoSys_Groq;

  if (!apiKey) {
    return res.status(200).json({
      step: "env_check",
      ok: false,
      error: "RevoSys_Groq env var is NOT set in this deployment",
      allEnvKeys: Object.keys(process.env).filter(k => !k.startsWith("NEXT") && !k.startsWith("NODE") && !k.startsWith("PATH") && !k.startsWith("npm")),
    });
  }

  // Try a minimal Groq request
  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 10,
        messages: [{ role: "user", content: "Say OK" }],
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(200).json({
        step: "groq_request",
        ok: false,
        httpStatus: r.status,
        error: data.error?.message || JSON.stringify(data.error),
        keyPrefix: apiKey.slice(0, 8) + "...",
      });
    }

    return res.status(200).json({
      step: "success",
      ok: true,
      response: data.choices?.[0]?.message?.content,
      model: data.model,
      keyPrefix: apiKey.slice(0, 8) + "...",
    });
  } catch (err) {
    return res.status(200).json({
      step: "fetch_error",
      ok: false,
      error: err.message,
    });
  }
}
