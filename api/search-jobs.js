// Job search — aggregates REAL jobs from multiple verified sources
// Primary: JSearch (RapidAPI) → LinkedIn, Indeed, Glassdoor, ZipRecruiter
// Fallback: Remotive, Jobicy (free, no key needed)
//
// Required env: RevoSys_RapidAPI (free at rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch)

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { keywords, location, title, datePosted } = req.body || {};
  const query = (keywords || "CRM implementation HubSpot Salesforce revenue operations").trim();
  const loc = (location || "").trim();
  const titleFilter = (title || "").toLowerCase().trim();
  const allJobs = [];
  const errors = [];
  const activeSources = [];

  // Helper: post-filter by title keyword
  const titleMatch = (job) => {
    if (!titleFilter) return true;
    const t = (job.title || "").toLowerCase();
    // Match any word from the title filter
    return titleFilter.split(/[\s,]+/).filter(Boolean).some(w => t.includes(w));
  };

  // Helper: post-filter by location
  const locMatch = (job) => {
    if (!loc) return true;
    const l = loc.toLowerCase();
    const jl = (job.location || "").toLowerCase();
    if (l === "remote") return jl.includes("remote") || jl.includes("worldwide") || jl.includes("anywhere");
    return jl.includes(l);
  };

  // Helper: date filter for free sources (no native date filter)
  const dateMatch = (job) => {
    if (!datePosted || datePosted === "all" || datePosted === "month") return true;
    if (!job._postedDate) return true; // can't filter, include it
    const now = new Date();
    const posted = new Date(job._postedDate);
    const diffDays = (now - posted) / (1000 * 60 * 60 * 24);
    if (datePosted === "today") return diffDays <= 1;
    if (datePosted === "3days") return diffDays <= 3;
    if (datePosted === "week") return diffDays <= 7;
    return true;
  };

  // ═══════════════════════════════════════════════════════════
  // SOURCE 1: JSearch (RapidAPI) — LinkedIn, Indeed, Glassdoor, ZipRecruiter
  // Free tier: 500 requests/month
  // ═══════════════════════════════════════════════════════════
  const rapidKey = process.env.RevoSys_RapidAPI;
  if (rapidKey) {
    try {
      // JSearch expects a natural language query, not comma-separated
      const searchQuery = query.replace(/,/g, " ").replace(/\s+/g, " ").trim();
      const locationQuery = loc ? ` in ${loc}` : "";
      const titleQuery = titleFilter ? ` ${titleFilter}` : "";
      const fullQuery = `${searchQuery}${titleQuery}${locationQuery}`;

      const params = new URLSearchParams({
        query: fullQuery,
        page: "1",
        num_pages: "2",
        date_posted: datePosted || "month",
      });

      // Add remote filter if specified
      if (loc && loc.toLowerCase() === "remote") {
        params.set("remote_jobs_only", "true");
      }

      const r = await fetch(
        `https://jsearch.p.rapidapi.com/search?${params}`,
        {
          headers: {
            "X-RapidAPI-Key": rapidKey,
            "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
          },
          signal: AbortSignal.timeout(12000),
        }
      );

      if (r.ok) {
        const d = await r.json();
        const jobs = d.data || [];
        for (const job of jobs) {
          const j = {
            id: `jsearch_${job.job_id}`,
            title: job.job_title || "",
            company: job.employer_name || "Unknown",
            companyLogo: job.employer_logo || null,
            companyWebsite: job.employer_website || null,
            platform: job.job_publisher || "Indeed",
            type: job.job_employment_type || "Full-time",
            location: job.job_city
              ? `${job.job_city}, ${job.job_state || ""} ${job.job_country || ""}`.trim()
              : job.job_is_remote
              ? "Remote"
              : job.job_country || "Not specified",
            posted: job.job_posted_at_datetime_utc
              ? new Date(job.job_posted_at_datetime_utc).toLocaleDateString()
              : "Recent",
            _postedDate: job.job_posted_at_datetime_utc || null,
            description: (job.job_description || "").substring(0, 500).replace(/\n+/g, " "),
            tags: [
              job.job_employment_type,
              ...(job.job_required_skills || []),
            ].filter(Boolean),
            salary:
              job.job_min_salary && job.job_max_salary
                ? `$${Math.round(job.job_min_salary / 1000)}k–$${Math.round(job.job_max_salary / 1000)}k`
                : job.job_salary_period
                ? `${job.job_salary_currency || "$"}${job.job_min_salary || "?"}/${job.job_salary_period}`
                : "Not listed",
            url: job.job_apply_link || job.job_google_link || "",
            source: (job.job_publisher || "jsearch").toLowerCase(),
          };
          if (titleMatch(j) && locMatch(j)) allJobs.push(j);
        }
        // Track which publishers we actually got results from
        const publishers = [...new Set(jobs.map(j => j.job_publisher).filter(Boolean))];
        activeSources.push(...(publishers.length ? publishers : ["LinkedIn", "Indeed", "Glassdoor", "ZipRecruiter"]));
      } else {
        const err = await r.text().catch(() => "");
        errors.push({
          source: "JSearch",
          error: `HTTP ${r.status}: ${err.substring(0, 200)}`,
        });
      }
    } catch (e) {
      errors.push({ source: "JSearch", error: e.message });
    }
  } else {
    errors.push({ source: "JSearch", error: "RevoSys_RapidAPI key not configured" });
  }

  // ═══════════════════════════════════════════════════════════
  // SOURCE 2: Remotive (free, no key) — remote tech jobs
  // ═══════════════════════════════════════════════════════════
  try {
    // Remotive search works best with single keywords, not long phrases
    // Split user's keywords and search with the most specific ones
    const terms = query
      .split(/[,\s]+/)
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 2)
      .filter(t => !["and", "the", "for", "with", "from"].includes(t));

    const searchTerms = terms.slice(0, 4);
    const seen = new Set();

    for (const term of searchTerms.length ? searchTerms : ["crm"]) {
      try {
        const r = await fetch(
          `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(term)}&limit=20`,
          {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(8000),
          }
        );
        if (r.ok) {
          const d = await r.json();
          for (const job of d.jobs || []) {
            if (seen.has(job.id)) continue;
            seen.add(job.id);
            const j = {
              id: `remotive_${job.id}`,
              title: job.title || "",
              company: job.company_name || "Unknown",
              companyLogo: job.company_logo || null,
              companyWebsite: null,
              platform: "Remotive",
              type: job.job_type ? job.job_type.replace(/_/g, " ") : "Full-time",
              location: job.candidate_required_location || "Remote",
              posted: job.publication_date
                ? new Date(job.publication_date).toLocaleDateString()
                : "Recent",
              _postedDate: job.publication_date || null,
              description: (job.description || "")
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .substring(0, 500),
              tags: job.tags || [],
              salary: job.salary || "Not listed",
              url: job.url || "",
              source: "remotive.com",
            };
            if (titleMatch(j) && locMatch(j) && dateMatch(j)) allJobs.push(j);
          }
        }
      } catch {}
    }
    activeSources.push("Remotive");
  } catch (e) {
    errors.push({ source: "Remotive", error: e.message });
  }

  // ═══════════════════════════════════════════════════════════
  // SOURCE 3: Jobicy (free, no key) — remote jobs
  // ═══════════════════════════════════════════════════════════
  try {
    // Jobicy uses tag-based search
    const tags = query
      .split(/[,\s]+/)
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 2)
      .filter(t => !["and", "the", "for", "with", "from"].includes(t))
      .slice(0, 5)
      .join(",");

    const r = await fetch(
      `https://jobicy.com/api/v2/remote-jobs?count=50&tag=${encodeURIComponent(tags || "crm,marketing,sales")}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (r.ok) {
      const d = await r.json();
      for (const job of d.jobs || []) {
        const j = {
          id: `jobicy_${job.id}`,
          title: job.jobTitle || "",
          company: job.companyName || "Unknown",
          companyLogo: job.companyLogo || null,
          companyWebsite: job.companyWebsite || null,
          platform: "Jobicy",
          type: job.jobType || "Full-time",
          location: job.jobGeo || "Remote",
          posted: job.pubDate
            ? new Date(job.pubDate).toLocaleDateString()
            : "Recent",
          _postedDate: job.pubDate || null,
          description: (job.jobExcerpt || "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .substring(0, 500),
          tags: job.jobIndustry ? [job.jobIndustry] : [],
          salary:
            job.annualSalaryMin && job.annualSalaryMax
              ? `$${(job.annualSalaryMin / 1000).toFixed(0)}k–$${(job.annualSalaryMax / 1000).toFixed(0)}k`
              : "Not listed",
          url: job.url || "",
          source: "jobicy.com",
        };
        if (titleMatch(j) && locMatch(j) && dateMatch(j)) allJobs.push(j);
      }
      activeSources.push("Jobicy");
    }
  } catch (e) {
    errors.push({ source: "Jobicy", error: e.message });
  }

  // Deduplicate by normalized title+company
  const seenMap = new Map();
  const unique = [];
  for (const j of allJobs) {
    const key = (j.title + j.company)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    if (!seenMap.has(key)) {
      seenMap.set(key, true);
      // Remove internal fields
      const { _postedDate, ...clean } = j;
      unique.push(clean);
    }
  }

  return res.status(200).json({
    jobs: unique,
    count: unique.length,
    sources: [...new Set(activeSources)],
    hasRapidAPI: !!rapidKey,
    errors: errors.length > 0 ? errors : undefined,
    query: query,
    filters: { location: loc, title: titleFilter, datePosted },
  });
}
