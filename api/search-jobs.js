// Job search — aggregates REAL jobs from multiple sources
// Primary: JSearch (RapidAPI) → LinkedIn, Indeed, Glassdoor, ZipRecruiter, Upwork
// Fallback: Remotive, Himalayas, Jobicy, Arbeitnow (free, no key)
//
// Required env: RevoSys_RapidAPI (free at rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch)
// Optional: works without it using fallback sources only

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { keywords, location, title, datePosted, jobType } = req.body || {};
  const query =
    keywords || "CRM implementation HubSpot Salesforce revenue operations";
  const loc = location || "";
  const titleFilter = (title || "").toLowerCase();
  const allJobs = [];
  const errors = [];
  const activeSources = [];

  // Build search query combining keywords + title + location for APIs that take a single query
  const fullQuery = [query, titleFilter, loc].filter(Boolean).join(" ");

  // Helper: normalize job object
  const norm = (j) => ({
    ...j,
    _searchText: [j.title, j.company, j.description, ...(j.tags || [])]
      .join(" ")
      .toLowerCase(),
  });

  // Helper: post-filter by title if provided
  const titleMatch = (job) => {
    if (!titleFilter) return true;
    return job.title.toLowerCase().includes(titleFilter);
  };

  // Helper: post-filter by location if provided
  const locMatch = (job) => {
    if (!loc) return true;
    const l = loc.toLowerCase();
    return (
      (job.location || "").toLowerCase().includes(l) ||
      l === "remote" && (job.location || "").toLowerCase().includes("remote")
    );
  };

  // ═══════════════════════════════════════════════════════════
  // SOURCE 1: JSearch (RapidAPI) — LinkedIn, Indeed, Glassdoor, ZipRecruiter
  // Free tier: 500 requests/month
  // ═══════════════════════════════════════════════════════════
  const rapidKey = process.env.RevoSys_RapidAPI;
  if (rapidKey) {
    try {
      const params = new URLSearchParams({
        query: fullQuery,
        page: "1",
        num_pages: "2",
        date_posted: datePosted || "month",
        ...(loc ? { remote_jobs_only: loc.toLowerCase() === "remote" ? "true" : "false" } : {}),
      });
      const r = await fetch(
        `https://jsearch.p.rapidapi.com/search?${params}`,
        {
          headers: {
            "X-RapidAPI-Key": rapidKey,
            "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
          },
          signal: AbortSignal.timeout(10000),
        }
      );
      if (r.ok) {
        const d = await r.json();
        for (const job of d.data || []) {
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
            description: (job.job_description || "")
              .substring(0, 400)
              .replace(/\n+/g, " "),
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
        activeSources.push(
          "LinkedIn",
          "Indeed",
          "Glassdoor",
          "ZipRecruiter"
        );
      } else {
        const err = await r.json().catch(() => ({}));
        errors.push({
          source: "JSearch",
          error: err.message || `HTTP ${r.status}`,
        });
      }
    } catch (e) {
      errors.push({ source: "JSearch", error: e.message });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SOURCE 2: Remotive (free, no key) — remote jobs
  // ═══════════════════════════════════════════════════════════
  try {
    const terms = query
      .split(/[,\s]+/)
      .filter((t) => t.length > 2)
      .slice(0, 3);
    const seen = new Set();
    for (const q of terms.length ? terms : ["crm"]) {
      try {
        const r = await fetch(
          `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(q)}&limit=15`,
          {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(6000),
          }
        );
        if (r.ok) {
          const d = await r.json();
          for (const job of d.jobs || []) {
            if (seen.has(job.id)) continue;
            seen.add(job.id);
            const j = {
              id: `remotive_${job.id}`,
              title: job.title,
              company: job.company_name,
              companyLogo: job.company_logo || null,
              companyWebsite: null,
              platform: "Remotive",
              type: job.job_type
                ? job.job_type.replace(/_/g, " ")
                : "Full-time",
              location:
                job.candidate_required_location || "Remote",
              posted: job.publication_date
                ? new Date(job.publication_date).toLocaleDateString()
                : "Recent",
              description: (job.description || "")
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .substring(0, 400),
              tags: job.tags || [],
              salary: job.salary || "Not listed",
              url: job.url,
              source: "remotive.com",
            };
            if (titleMatch(j) && locMatch(j)) allJobs.push(j);
          }
        }
      } catch {}
    }
    activeSources.push("Remotive");
  } catch (e) {
    errors.push({ source: "Remotive", error: e.message });
  }

  // ═══════════════════════════════════════════════════════════
  // SOURCE 3: Jobicy (free, no key)
  // ═══════════════════════════════════════════════════════════
  try {
    const tag = query
      .split(/[,\s]+/)
      .filter((t) => t.length > 2)
      .slice(0, 5)
      .join(",");
    const r = await fetch(
      `https://jobicy.com/api/v2/remote-jobs?count=50&tag=${encodeURIComponent(tag || "crm,marketing,sales")}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(6000),
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
          description: (job.jobExcerpt || "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .substring(0, 400),
          tags: job.jobIndustry ? [job.jobIndustry] : [],
          salary:
            job.annualSalaryMin && job.annualSalaryMax
              ? `$${(job.annualSalaryMin / 1000).toFixed(0)}k–$${(job.annualSalaryMax / 1000).toFixed(0)}k`
              : "Not listed",
          url: job.url,
          source: "jobicy.com",
        };
        if (titleMatch(j) && locMatch(j)) allJobs.push(j);
      }
      activeSources.push("Jobicy");
    }
  } catch (e) {
    errors.push({ source: "Jobicy", error: e.message });
  }

  // ═══════════════════════════════════════════════════════════
  // SOURCE 4: Arbeitnow (free, no key)
  // ═══════════════════════════════════════════════════════════
  try {
    const r = await fetch(
      "https://www.arbeitnow.com/api/job-board-api?page=1",
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(6000),
      }
    );
    if (r.ok) {
      const d = await r.json();
      const terms = query.split(/[,\s]+/).map((t) => t.toLowerCase().trim()).filter((t) => t.length > 2);
      for (const job of d.data || []) {
        const text = (
          job.title +
          " " +
          (job.description || "") +
          " " +
          (job.tags || []).join(" ")
        ).toLowerCase();
        const kwMatch = terms.some((t) => text.includes(t));
        if (!kwMatch) continue;
        const j = {
          id: `arbeitnow_${job.slug}`,
          title: job.title,
          company: job.company_name || "Unknown",
          companyLogo: null,
          companyWebsite: null,
          platform: "Arbeitnow",
          type: job.remote ? "Remote" : "On-site",
          location: job.location || "Not specified",
          posted: job.created_at
            ? new Date(job.created_at * 1000).toLocaleDateString()
            : "Recent",
          description: (job.description || "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .substring(0, 400),
          tags: job.tags || [],
          salary: "Not listed",
          url: job.url,
          source: "arbeitnow.com",
        };
        if (titleMatch(j) && locMatch(j)) allJobs.push(j);
      }
      activeSources.push("Arbeitnow");
    }
  } catch (e) {
    errors.push({ source: "Arbeitnow", error: e.message });
  }

  // ═══════════════════════════════════════════════════════════
  // SOURCE 5: Himalayas (free, no key)
  // ═══════════════════════════════════════════════════════════
  try {
    const r = await fetch("https://himalayas.app/jobs/api?limit=50", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (r.ok) {
      const d = await r.json();
      const terms = query.split(/[,\s]+/).map((t) => t.toLowerCase().trim()).filter((t) => t.length > 2);
      for (const job of d.jobs || []) {
        const text = (
          job.title +
          " " +
          (job.description || "") +
          " " +
          (job.categories || []).join(" ")
        ).toLowerCase();
        const kwMatch = terms.some((t) => text.includes(t));
        if (!kwMatch) continue;
        const j = {
          id: `himalayas_${job.id}`,
          title: job.title,
          company: job.companyName || "Unknown",
          companyLogo: job.companyLogo || null,
          companyWebsite: job.companyUrl || null,
          platform: "Himalayas",
          type: job.type || "Full-time",
          location: job.locationRestrictions?.[0] || "Worldwide",
          posted: job.pubDate
            ? new Date(job.pubDate).toLocaleDateString()
            : "Recent",
          description: (job.description || job.excerpt || "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .substring(0, 400),
          tags: job.categories || [],
          salary:
            job.minSalary && job.maxSalary
              ? `$${(job.minSalary / 1000).toFixed(0)}k–$${(job.maxSalary / 1000).toFixed(0)}k`
              : "Not listed",
          url:
            job.applicationUrl ||
            `https://himalayas.app/jobs/${job.slug}`,
          source: "himalayas.app",
        };
        if (titleMatch(j) && locMatch(j)) allJobs.push(j);
      }
      activeSources.push("Himalayas");
    }
  } catch (e) {
    errors.push({ source: "Himalayas", error: e.message });
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
      unique.push(j);
    }
  }

  return res.status(200).json({
    jobs: unique,
    count: unique.length,
    sources: [...new Set(activeSources)],
    hasRapidAPI: !!rapidKey,
    errors: errors.length > 0 ? errors : undefined,
  });
}
