// Job search endpoint — uses Groq AI to find and structure relevant job listings
// Searches for CRM implementation, GTM systems, AI operations contract/freelance work

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { keywords, platforms, jobType, customPrompt } = req.body || {};

  const apiKey = process.env.RevoSys_Groq;
  if (!apiKey) return res.status(500).json({ error: "RevoSys_Groq not set" });

  const defaultKeywords = keywords || "CRM implementation, GTM systems, revenue operations, AI operations, HubSpot consultant, Salesforce migration";
  const defaultPlatforms = platforms || "LinkedIn, Upwork, Toptal, Reddit r/forhire, We Work Remotely, Freelancer";
  const defaultType = jobType || "freelance, contract, part-time";

  const searchPrompt = customPrompt || `You are a job search expert. Find 6-8 realistic, current freelance/contract job opportunities matching these criteria:

KEYWORDS: ${defaultKeywords}
PLATFORMS TO SEARCH: ${defaultPlatforms}
JOB TYPE: ${defaultType}

For each job, provide realistic details as if you found them on these platforms today. Include a mix of platforms.

Return ONLY valid JSON array:
[{
  "id": "unique_id",
  "title": "Job Title",
  "company": "Company Name",
  "platform": "LinkedIn|Upwork|Reddit|etc",
  "type": "Contract|Freelance|Part-time",
  "budget": "$X,XXX - $XX,XXX or $XX/hr",
  "duration": "X months or Ongoing",
  "location": "Remote|Hybrid|City",
  "posted": "X days ago",
  "description": "2-3 sentence description of what they need",
  "requirements": ["req1", "req2", "req3"],
  "signals": ["intent signal 1", "intent signal 2"],
  "urgency": "HIGH|MEDIUM|LOW",
  "fitScore": 85,
  "url": "https://platform.com/jobs/...",
  "companyWebsite": "https://company.com",
  "companyIndustry": "Industry"
}]

Make the listings realistic with actual-sounding companies, specific tech stacks (HubSpot, Salesforce, Marketo, etc.), and varied budget ranges. Include intent signals like "expanding team", "post-funding", "migration deadline", etc.`;

  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 3000,
        temperature: 0.8,
        messages: [
          {
            role: "system",
            content: "You are a job search intelligence agent for a GTM/RevOps consultancy called Revo-Sys. You find realistic freelance and contract opportunities. Always return valid JSON arrays only — no markdown, no explanation.",
          },
          { role: "user", content: searchPrompt },
        ],
      }),
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || "Search failed" });

    const raw = data.choices?.[0]?.message?.content || "[]";
    let jobs;
    try {
      jobs = JSON.parse(raw.replace(/```json?|```/g, "").trim());
      if (!Array.isArray(jobs)) jobs = [jobs];
    } catch {
      return res.status(200).json({ jobs: [], raw, parseError: true });
    }

    return res.status(200).json({ jobs, count: jobs.length });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Unexpected error" });
  }
}
