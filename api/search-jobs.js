// Job search — aggregates REAL jobs from multiple verified sources
// Primary: JSearch (RapidAPI) → LinkedIn, Indeed, Glassdoor, ZipRecruiter
// Fallback: Remotive, Jobicy (free, no key needed)
//
// Strategy: split user keywords into groups, run PARALLEL JSearch queries
// to maximize coverage across different job types

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { keywords, location, title, datePosted } = req.body || {};
  const query = (keywords || "CRM HubSpot Salesforce marketing operations consulting automation").trim();
  const loc = (location || "").trim();
  const titleFilter = (title || "").toLowerCase().trim();
  const allJobs = [];
  const errors = [];
  const activeSources = [];
  const seenIds = new Set();

  // Split keywords into individual search terms
  const terms = query
    .split(/[,]+/)
    .map(t => t.trim())
    .filter(t => t.length > 1);

  // Helper: post-filter by title keyword
  const titleMatch = (job) => {
    if (!titleFilter) return true;
    const t = (job.title || "").toLowerCase();
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

  // Helper: date filter for free sources
  const dateMatch = (job) => {
    if (!datePosted || datePosted === "all" || datePosted === "month") return true;
    if (!job._postedDate) return true;
    const now = new Date();
    const posted = new Date(job._postedDate);
    const diffDays = (now - posted) / (1000 * 60 * 60 * 24);
    if (datePosted === "today") return diffDays <= 1;
    if (datePosted === "3days") return diffDays <= 3;
    if (datePosted === "week") return diffDays <= 7;
    return true;
  };

  // Helper: normalize JSearch job into our format
  const normalizeJSearchJob = (job) => ({
    id: `jsearch_${job.job_id}`,
    title: job.job_title || "",
    company: job.employer_name || "Unknown",
    companyLogo: job.employer_logo || null,
    companyWebsite: job.employer_website || null,
    platform: job.job_publisher || "Indeed",
    type: job.job_employment_type
      ? job.job_employment_type.replace("FULLTIME", "Full-time").replace("PARTTIME", "Part-time").replace("CONTRACTOR", "Contract").replace("INTERN", "Internship")
      : "Full-time",
    location: job.job_city
      ? `${job.job_city}, ${job.job_state || ""} ${job.job_country || ""}`.trim()
      : job.job_is_remote ? "Remote" : job.job_country || "Not specified",
    posted: job.job_posted_at_datetime_utc
      ? new Date(job.job_posted_at_datetime_utc).toLocaleDateString()
      : "Recent",
    _postedDate: job.job_posted_at_datetime_utc || null,
    description: (job.job_description || "").substring(0, 600).replace(/\n+/g, " "),
    tags: [
      job.job_employment_type,
      ...(job.job_required_skills || []),
    ].filter(Boolean).slice(0, 6),
    salary:
      job.job_min_salary && job.job_max_salary
        ? `$${Math.round(job.job_min_salary / 1000)}k-$${Math.round(job.job_max_salary / 1000)}k`
        : job.job_salary_period
        ? `${job.job_salary_currency || "$"}${job.job_min_salary || "?"}/${job.job_salary_period}`
        : "Not listed",
    url: job.job_apply_link || job.job_google_link || "",
    source: (job.job_publisher || "jsearch").toLowerCase(),
  });

  // ═══════════════════════════════════════════════════════════
  // SOURCE 1: JSearch (RapidAPI) — LinkedIn, Indeed, Glassdoor, etc.
  // Strategy: run up to 3 parallel searches with different keyword groups
  // to maximize coverage while conserving API quota
  // ═══════════════════════════════════════════════════════════
  const rapidKey = process.env.RevoSys_RapidAPI;
  if (rapidKey) {
    // Build up to 3 search queries from user's keywords
    const searchQueries = [];
    if (terms.length <= 2) {
      // Few keywords: search each individually
      terms.forEach(t => searchQueries.push(t));
    } else {
      // Many keywords: create 2-3 focused query groups
      // Group 1: first 2 terms combined (most specific)
      searchQueries.push(terms.slice(0, 2).join(" "));
      // Group 2: next 2 terms
      if (terms.length > 2) searchQueries.push(terms.slice(2, 4).join(" "));
      // Group 3: remaining terms
      if (terms.length > 4) searchQueries.push(terms.slice(4, 6).join(" "));
    }

    // Run all JSearch queries in parallel
    const jsearchPromises = searchQueries.slice(0, 3).map(async (sq) => {
      try {
        const locationSuffix = loc && loc.toLowerCase() !== "remote" ? ` in ${loc}` : "";
        const titleSuffix = titleFilter ? ` ${titleFilter}` : "";
        const fullQuery = `${sq}${titleSuffix}${locationSuffix}`;

        const params = new URLSearchParams({
          query: fullQuery,
          page: "1",
          num_pages: "1",
          date_posted: datePosted || "month",
        });

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
            signal: AbortSignal.timeout(20000),
          }
        );

        if (r.ok) {
          const d = await r.json();
          return { data: d.data || [], query: fullQuery };
        } else {
          const err = await r.text().catch(() => "");
          return { error: `HTTP ${r.status}: ${err.substring(0, 200)}`, query: fullQuery };
        }
      } catch (e) {
        return { error: e.message, query: sq };
      }
    });

    const results = await Promise.all(jsearchPromises);
    const publisherSet = new Set();

    for (const result of results) {
      if (result.error) {
        errors.push({ source: "JSearch", error: result.error });
        continue;
      }
      for (const job of result.data) {
        if (seenIds.has(job.job_id)) continue;
        seenIds.add(job.job_id);
        const j = normalizeJSearchJob(job);
        if (titleMatch(j) && locMatch(j)) {
          allJobs.push(j);
          if (job.job_publisher) publisherSet.add(job.job_publisher);
        }
      }
    }

    if (publisherSet.size > 0) {
      activeSources.push(...publisherSet);
    }
  } else {
    errors.push({ source: "JSearch", error: "RevoSys_RapidAPI key not configured" });
  }

  // ═══════════════════════════════════════════════════════════
  // SOURCE 2: Remotive (free, no key) — remote tech/ops jobs
  // ═══════════════════════════════════════════════════════════
  try {
    const searchTerms = terms
      .map(t => t.toLowerCase().split(/\s+/))
      .flat()
      .filter(t => t.length > 2 && !["and", "the", "for", "with", "from"].includes(t))
      .slice(0, 4);

    const remotiveSeen = new Set();
    const remotivePromises = (searchTerms.length ? searchTerms : ["crm"]).map(async (term) => {
      try {
        const r = await fetch(
          `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(term)}&limit=15`,
          { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }
        );
        if (r.ok) return (await r.json()).jobs || [];
        return [];
      } catch { return []; }
    });

    const remotiveResults = await Promise.all(remotivePromises);
    for (const jobList of remotiveResults) {
      for (const job of jobList) {
        if (remotiveSeen.has(job.id)) continue;
        remotiveSeen.add(job.id);
        const j = {
          id: `remotive_${job.id}`,
          title: job.title || "",
          company: job.company_name || "Unknown",
          companyLogo: job.company_logo || null,
          companyWebsite: null,
          platform: "Remotive",
          type: job.job_type ? job.job_type.replace(/_/g, " ") : "Full-time",
          location: job.candidate_required_location || "Remote",
          posted: job.publication_date ? new Date(job.publication_date).toLocaleDateString() : "Recent",
          _postedDate: job.publication_date || null,
          description: (job.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().substring(0, 600),
          tags: job.tags || [],
          salary: job.salary || "Not listed",
          url: job.url || "",
          source: "remotive.com",
        };
        if (titleMatch(j) && locMatch(j) && dateMatch(j)) allJobs.push(j);
      }
    }
    activeSources.push("Remotive");
  } catch (e) {
    errors.push({ source: "Remotive", error: e.message });
  }

  // ═══════════════════════════════════════════════════════════
  // SOURCE 3: Jobicy (free, no key) — remote jobs
  // ═══════════════════════════════════════════════════════════
  try {
    const tags = terms
      .map(t => t.toLowerCase().replace(/\s+/g, "-"))
      .filter(t => t.length > 2)
      .slice(0, 5)
      .join(",");

    const r = await fetch(
      `https://jobicy.com/api/v2/remote-jobs?count=50&tag=${encodeURIComponent(tags || "crm,marketing,sales")}`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }
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
          posted: job.pubDate ? new Date(job.pubDate).toLocaleDateString() : "Recent",
          _postedDate: job.pubDate || null,
          description: (job.jobExcerpt || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().substring(0, 600),
          tags: job.jobIndustry ? [job.jobIndustry] : [],
          salary: job.annualSalaryMin && job.annualSalaryMax
            ? `$${(job.annualSalaryMin / 1000).toFixed(0)}k-$${(job.annualSalaryMax / 1000).toFixed(0)}k`
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
  const dedupeMap = new Map();
  const unique = [];
  for (const j of allJobs) {
    const key = (j.title + j.company).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!dedupeMap.has(key)) {
      dedupeMap.set(key, true);
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
    query,
    searchGroups: terms.length,
  });
}
