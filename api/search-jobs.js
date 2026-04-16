// Job search endpoint — aggregates REAL jobs from free public APIs
// Sources: Remotive, Jobicy, Himalayas, and Arbeitsagentur (all free, no key required)

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { keywords } = req.body || {};
  const searchTerms = (keywords || "CRM,HubSpot,Salesforce,revenue operations,GTM,marketing operations")
    .split(",")
    .map((s) => s.trim().toLowerCase());

  const allJobs = [];
  const errors = [];

  // Helper: check if a job matches any of the search keywords
  const matches = (text) => {
    if (!text) return false;
    const lower = text.toLowerCase();
    return searchTerms.some((term) => lower.includes(term));
  };

  // ── Source 1: Remotive (free, no key) ──
  try {
    // Remotive supports a search query param
    const queries = ["crm", "hubspot", "salesforce", "revenue operations", "marketing operations", "gtm"];
    const seen = new Set();
    for (const q of queries) {
      try {
        const r = await fetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(q)}&limit=10`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(6000),
        });
        if (r.ok) {
          const d = await r.json();
          for (const job of d.jobs || []) {
            if (seen.has(job.id)) continue;
            seen.add(job.id);
            const desc = (job.title + " " + (job.description || "") + " " + (job.tags || []).join(" ")).toLowerCase();
            if (matches(desc) || matches(job.title) || matches(job.company_name)) {
              allJobs.push({
                id: `remotive_${job.id}`,
                title: job.title,
                company: job.company_name,
                companyLogo: job.company_logo || null,
                companyWebsite: job.company_logo ? null : null,
                platform: "Remotive",
                type: job.job_type ? job.job_type.replace("_", " ") : "Full-time",
                location: job.candidate_required_location || "Remote",
                posted: job.publication_date ? new Date(job.publication_date).toLocaleDateString() : "Recent",
                description: (job.description || "")
                  .replace(/<[^>]+>/g, " ")
                  .replace(/\s+/g, " ")
                  .trim()
                  .substring(0, 300),
                tags: job.tags || [],
                salary: job.salary || "Not listed",
                url: job.url,
                source: "remotive.com",
              });
            }
          }
        }
      } catch {}
    }
  } catch (e) {
    errors.push({ source: "Remotive", error: e.message });
  }

  // ── Source 2: Himalayas (free, no key) ──
  try {
    const r = await fetch("https://himalayas.app/jobs/api?limit=50", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (r.ok) {
      const d = await r.json();
      for (const job of d.jobs || []) {
        const text = (job.title + " " + (job.description || "") + " " + (job.categories || []).join(" "));
        if (matches(text) || matches(job.title) || matches(job.companyName)) {
          allJobs.push({
            id: `himalayas_${job.id}`,
            title: job.title,
            company: job.companyName || "Unknown",
            companyLogo: job.companyLogo || null,
            companyWebsite: job.companyUrl || null,
            platform: "Himalayas",
            type: job.type || "Full-time",
            location: job.locationRestrictions?.[0] || "Worldwide",
            posted: job.pubDate ? new Date(job.pubDate).toLocaleDateString() : "Recent",
            description: (job.description || job.excerpt || "")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .substring(0, 300),
            tags: job.categories || [],
            salary: job.minSalary && job.maxSalary
              ? `$${(job.minSalary / 1000).toFixed(0)}k–$${(job.maxSalary / 1000).toFixed(0)}k`
              : "Not listed",
            url: job.applicationUrl || `https://himalayas.app/jobs/${job.slug}`,
            source: "himalayas.app",
          });
        }
      }
    }
  } catch (e) {
    errors.push({ source: "Himalayas", error: e.message });
  }

  // ── Source 3: Jobicy (free, no key) ──
  try {
    const r = await fetch("https://jobicy.com/api/v2/remote-jobs?count=50&tag=crm,marketing,sales,operations", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (r.ok) {
      const d = await r.json();
      for (const job of d.jobs || []) {
        const text = (job.jobTitle + " " + (job.jobExcerpt || "") + " " + (job.jobIndustry || []));
        if (matches(text) || matches(job.jobTitle) || matches(job.companyName)) {
          allJobs.push({
            id: `jobicy_${job.id}`,
            title: job.jobTitle,
            company: job.companyName || "Unknown",
            companyLogo: job.companyLogo || null,
            companyWebsite: job.companyWebsite || null,
            platform: "Jobicy",
            type: job.jobType || "Full-time",
            location: job.jobGeo || "Remote",
            posted: job.pubDate ? new Date(job.pubDate).toLocaleDateString() : "Recent",
            description: (job.jobExcerpt || "")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .substring(0, 300),
            tags: job.jobIndustry ? [job.jobIndustry] : [],
            salary: job.annualSalaryMin && job.annualSalaryMax
              ? `$${(job.annualSalaryMin / 1000).toFixed(0)}k–$${(job.annualSalaryMax / 1000).toFixed(0)}k`
              : "Not listed",
            url: job.url,
            source: "jobicy.com",
          });
        }
      }
    }
  } catch (e) {
    errors.push({ source: "Jobicy", error: e.message });
  }

  // ── Source 4: Arbeitnow (free, no key) ──
  try {
    const r = await fetch("https://www.arbeitnow.com/api/job-board-api?page=1", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (r.ok) {
      const d = await r.json();
      for (const job of d.data || []) {
        const text = (job.title + " " + (job.description || "") + " " + (job.tags || []).join(" "));
        if (matches(text) || matches(job.title) || matches(job.company_name)) {
          allJobs.push({
            id: `arbeitnow_${job.slug}`,
            title: job.title,
            company: job.company_name || "Unknown",
            companyLogo: null,
            companyWebsite: null,
            platform: "Arbeitnow",
            type: job.remote ? "Remote" : "On-site",
            location: job.location || "Not specified",
            posted: job.created_at ? new Date(job.created_at * 1000).toLocaleDateString() : "Recent",
            description: (job.description || "")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .substring(0, 300),
            tags: job.tags || [],
            salary: "Not listed",
            url: job.url,
            source: "arbeitnow.com",
          });
        }
      }
    }
  } catch (e) {
    errors.push({ source: "Arbeitnow", error: e.message });
  }

  // Deduplicate by title+company
  const seen = new Map();
  const unique = [];
  for (const j of allJobs) {
    const key = (j.title + j.company).toLowerCase().replace(/\s+/g, "");
    if (!seen.has(key)) {
      seen.set(key, true);
      unique.push(j);
    }
  }

  return res.status(200).json({
    jobs: unique,
    count: unique.length,
    sources: ["Remotive", "Himalayas", "Jobicy", "Arbeitnow"],
    errors: errors.length > 0 ? errors : undefined,
  });
}
