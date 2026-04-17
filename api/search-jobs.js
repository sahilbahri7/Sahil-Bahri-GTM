// Job search — aggregates REAL jobs from multiple verified sources
// Primary: JSearch (RapidAPI) → LinkedIn, Indeed, Glassdoor, ZipRecruiter, Upwork
// Fallback: Remotive, Jobicy (free, no key needed)
//
// Design notes:
// - Filters are LENIENT: location is matched against country/province/city
//   hints so "Canada" also matches "Toronto, ON".
// - Title filter is matched against title OR description (ANY token).
// - Diagnostics include per-source raw vs. filtered counts so we can see
//   where results were dropped.

// ─── Location intelligence ────────────────────────────────────────
// Map common country labels to 2-letter ISO codes (JSearch `country` param)
// and provide city/province hints for post-filtering aggregator feeds.
const COUNTRY_META = {
  canada:       { code: "ca", hints: ["canada","ontario","quebec","british columbia","alberta","manitoba","saskatchewan","nova scotia","new brunswick","toronto","vancouver","montreal","ottawa","calgary","edmonton","mississauga","winnipeg","halifax","victoria","waterloo","hamilton","kitchener","burnaby","surrey","richmond","brampton","laval","gatineau","quebec city"] },
  "united states": { code: "us", hints: ["united states","usa","u.s.","u.s.a","america","new york","california","texas","florida","seattle","boston","chicago","los angeles","san francisco","austin","denver","atlanta","washington","miami","houston","dallas","philadelphia","phoenix","portland","san diego","nashville","minneapolis"] },
  usa:          { code: "us", hints: ["united states","usa","u.s.","u.s.a","america","new york","california","texas","florida","seattle","boston","chicago","los angeles","san francisco","austin","denver","atlanta","washington","miami","houston","dallas","philadelphia","phoenix","portland","san diego","nashville","minneapolis"] },
  us:           { code: "us", hints: ["united states","usa","u.s.","u.s.a","america","new york","california","texas","florida","seattle","boston","chicago","los angeles","san francisco","austin","denver","atlanta","washington","miami","houston","dallas","philadelphia","phoenix","portland","san diego","nashville","minneapolis"] },
  america:      { code: "us", hints: ["united states","usa","u.s.","u.s.a","america"] },
  "united kingdom": { code: "gb", hints: ["united kingdom","uk","england","scotland","wales","london","manchester","edinburgh","glasgow","bristol","leeds","birmingham","liverpool","cambridge","oxford"] },
  uk:           { code: "gb", hints: ["united kingdom","uk","england","scotland","wales","london","manchester","edinburgh","glasgow","bristol","leeds","birmingham","liverpool","cambridge","oxford"] },
  britain:      { code: "gb", hints: ["united kingdom","uk","england","scotland","wales","london","manchester","edinburgh"] },
  india:        { code: "in", hints: ["india","bangalore","bengaluru","mumbai","delhi","new delhi","gurgaon","gurugram","hyderabad","chennai","pune","kolkata","noida","ahmedabad"] },
  australia:    { code: "au", hints: ["australia","sydney","melbourne","brisbane","perth","adelaide","canberra"] },
  germany:      { code: "de", hints: ["germany","berlin","munich","münchen","hamburg","frankfurt","cologne","köln","stuttgart"] },
  france:       { code: "fr", hints: ["france","paris","lyon","marseille","toulouse","nice","bordeaux"] },
  netherlands:  { code: "nl", hints: ["netherlands","amsterdam","rotterdam","the hague","utrecht","eindhoven"] },
  ireland:      { code: "ie", hints: ["ireland","dublin","cork","galway","limerick"] },
  singapore:    { code: "sg", hints: ["singapore"] },
  "united arab emirates": { code: "ae", hints: ["united arab emirates","uae","dubai","abu dhabi"] },
  uae:          { code: "ae", hints: ["united arab emirates","uae","dubai","abu dhabi"] },
};

const resolveLocation = (loc) => {
  if (!loc) return null;
  const l = loc.toLowerCase().trim();
  if (!l) return null;
  if (["remote","anywhere","worldwide","global"].includes(l)) {
    return { kind: "remote", label: l };
  }
  if (COUNTRY_META[l]) {
    return { kind: "country", label: l, ...COUNTRY_META[l] };
  }
  // Free-form (city / state / region). Leave as a loose substring match.
  return { kind: "freeform", label: l, hints: [l] };
};

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
  const locInfo = resolveLocation(loc);
  const titleFilter = (title || "").toLowerCase().trim();
  const titleTokens = titleFilter
    .split(/[\s,;/|]+/)
    .map(t => t.trim())
    .filter(t => t.length > 1);
  const effectiveDate = ["today","3days","week","month","all"].includes(datePosted) ? datePosted : "all";

  const allJobs = [];
  const errors = [];
  const diagnostics = []; // per-source { source, raw, kept, dropped_location, dropped_title, dropped_date }
  const activeSources = [];
  const seenIds = new Set();

  // Split keywords into individual search terms (supports comma OR whitespace-only input)
  const rawTerms = query.includes(",")
    ? query.split(",").map(t => t.trim()).filter(t => t.length > 1)
    : query.split(/\s+/).map(t => t.trim()).filter(t => t.length > 1);
  const terms = rawTerms.length ? rawTerms : [query];

  // ─── Filter helpers ─────────────────────────────────────────────
  const titleMatch = (job) => {
    if (titleTokens.length === 0) return true;
    const hay = ((job.title || "") + " " + (job.description || "")).toLowerCase();
    // ANY token match — user gave alternatives, any one qualifies
    return titleTokens.some(t => hay.includes(t));
  };

  const locMatch = (job) => {
    if (!locInfo) return true;
    const jl = (job.location || "").toLowerCase();
    if (!jl) return true; // can't reject what we don't know
    if (locInfo.kind === "remote") {
      return jl.includes("remote") || jl.includes("worldwide") || jl.includes("anywhere") || jl.includes("global");
    }
    // country or freeform: hint hit
    if (locInfo.hints.some(h => jl.includes(h))) return true;
    // Worldwide-remote jobs count for any country (contractor-friendly)
    if (jl.includes("worldwide") || jl.includes("anywhere") || jl === "remote") return true;
    return false;
  };

  const dateMatch = (job) => {
    if (effectiveDate === "all") return true;
    if (!job._postedDate) return true; // unknown date → allow
    const diffDays = (Date.now() - new Date(job._postedDate).getTime()) / 86400000;
    if (effectiveDate === "today") return diffDays <= 1;
    if (effectiveDate === "3days") return diffDays <= 3;
    if (effectiveDate === "week")  return diffDays <= 7;
    if (effectiveDate === "month") return diffDays <= 31;
    return true;
  };

  // ─── Normalizers ────────────────────────────────────────────────
  const normalizeJSearchJob = (j) => ({
    id: `jsearch_${j.job_id}`,
    title: j.job_title || "",
    company: j.employer_name || "Unknown",
    companyLogo: j.employer_logo || null,
    companyWebsite: j.employer_website || null,
    platform: j.job_publisher || "Indeed",
    type: j.job_employment_type
      ? j.job_employment_type.replace("FULLTIME","Full-time").replace("PARTTIME","Part-time").replace("CONTRACTOR","Contract").replace("INTERN","Internship")
      : "Full-time",
    location: j.job_city
      ? `${j.job_city}, ${j.job_state || ""} ${j.job_country || ""}`.trim().replace(/\s+/g," ")
      : j.job_is_remote ? "Remote" : (j.job_country || "Not specified"),
    posted: j.job_posted_at_datetime_utc
      ? new Date(j.job_posted_at_datetime_utc).toLocaleDateString()
      : "Recent",
    _postedDate: j.job_posted_at_datetime_utc || null,
    description: (j.job_description || "").substring(0, 600).replace(/\n+/g," "),
    tags: [j.job_employment_type, ...(j.job_required_skills || [])].filter(Boolean).slice(0, 6),
    salary: j.job_min_salary && j.job_max_salary
      ? `$${Math.round(j.job_min_salary/1000)}k-$${Math.round(j.job_max_salary/1000)}k`
      : j.job_salary_period
      ? `${j.job_salary_currency || "$"}${j.job_min_salary || "?"}/${j.job_salary_period}`
      : "Not listed",
    url: j.job_apply_link || j.job_google_link || "",
    source: (j.job_publisher || "jsearch").toLowerCase(),
  });

  const applyFilters = (job, diag) => {
    if (!dateMatch(job)) { diag.dropped_date++; return false; }
    if (!locMatch(job))  { diag.dropped_location++; return false; }
    if (!titleMatch(job)){ diag.dropped_title++; return false; }
    return true;
  };

  // ═══════════════════════════════════════════════════════════
  // SOURCE 1: JSearch — LinkedIn, Indeed, Glassdoor, ZipRecruiter, Upwork
  // Strategy: run PARALLEL queries per keyword, pass `country` param
  // rather than injecting "in X" into the query string.
  // ═══════════════════════════════════════════════════════════
  const rapidKey = process.env.RevoSys_RapidAPI;
  if (rapidKey) {
    const diag = { source: "JSearch", raw: 0, kept: 0, dropped_location: 0, dropped_title: 0, dropped_date: 0 };

    // Build up to 3 search queries from the user's keywords
    const searchQueries = [];
    if (terms.length <= 2) {
      terms.forEach(t => searchQueries.push(t));
    } else {
      searchQueries.push(terms.slice(0, 2).join(" "));
      searchQueries.push(terms.slice(2, 4).join(" "));
      if (terms.length > 4) searchQueries.push(terms.slice(4, 6).join(" "));
    }

    // Clean title tokens as an additional query bias (NOT raw comma string)
    const titleBias = titleTokens.length ? " " + titleTokens.slice(0, 3).join(" ") : "";

    const jsearchPromises = searchQueries.slice(0, 3).map(async (sq) => {
      try {
        const params = new URLSearchParams({
          query: `${sq}${titleBias}`.trim(),
          page: "1",
          num_pages: "1",
          date_posted: effectiveDate,
        });

        if (locInfo?.kind === "remote") {
          params.set("remote_jobs_only", "true");
        } else if (locInfo?.kind === "country" && locInfo.code) {
          params.set("country", locInfo.code);
        } else if (locInfo?.kind === "freeform") {
          // free-text city/region: append "in X" as last resort
          params.set("query", `${sq}${titleBias} in ${locInfo.label}`.trim());
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
          return { data: d.data || [], query: params.get("query") };
        }
        const err = await r.text().catch(() => "");
        return { error: `HTTP ${r.status}: ${err.substring(0, 200)}`, query: params.get("query") };
      } catch (e) {
        return { error: e.message, query: sq };
      }
    });

    const results = await Promise.all(jsearchPromises);
    const publisherSet = new Set();

    for (const result of results) {
      if (result.error) {
        errors.push({ source: "JSearch", error: result.error, query: result.query });
        continue;
      }
      for (const job of result.data) {
        if (seenIds.has(job.job_id)) continue;
        seenIds.add(job.job_id);
        diag.raw++;
        const j = normalizeJSearchJob(job);
        if (applyFilters(j, diag)) {
          allJobs.push(j);
          diag.kept++;
          if (job.job_publisher) publisherSet.add(job.job_publisher);
        }
      }
    }

    diagnostics.push(diag);
    if (publisherSet.size > 0) activeSources.push(...publisherSet);
  } else {
    errors.push({ source: "JSearch", error: "RevoSys_RapidAPI key not configured" });
  }

  // ═══════════════════════════════════════════════════════════
  // SOURCE 2: Remotive (free, no key) — remote tech/ops jobs
  // ═══════════════════════════════════════════════════════════
  try {
    const diag = { source: "Remotive", raw: 0, kept: 0, dropped_location: 0, dropped_title: 0, dropped_date: 0 };
    const searchTerms = terms
      .map(t => t.toLowerCase().split(/\s+/)).flat()
      .filter(t => t.length > 2 && !["and","the","for","with","from"].includes(t))
      .slice(0, 4);

    const remotiveSeen = new Set();
    const remotivePromises = (searchTerms.length ? searchTerms : ["crm"]).map(async (term) => {
      try {
        const r = await fetch(
          `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(term)}&limit=20`,
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
        diag.raw++;
        const j = {
          id: `remotive_${job.id}`,
          title: job.title || "",
          company: job.company_name || "Unknown",
          companyLogo: job.company_logo || null,
          companyWebsite: null,
          platform: "Remotive",
          type: job.job_type ? job.job_type.replace(/_/g," ") : "Full-time",
          location: job.candidate_required_location || "Remote",
          posted: job.publication_date ? new Date(job.publication_date).toLocaleDateString() : "Recent",
          _postedDate: job.publication_date || null,
          description: (job.description || "").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().substring(0, 600),
          tags: job.tags || [],
          salary: job.salary || "Not listed",
          url: job.url || "",
          source: "remotive.com",
        };
        if (applyFilters(j, diag)) { allJobs.push(j); diag.kept++; }
      }
    }
    diagnostics.push(diag);
    if (diag.kept > 0) activeSources.push("Remotive");
  } catch (e) {
    errors.push({ source: "Remotive", error: e.message });
  }

  // ═══════════════════════════════════════════════════════════
  // SOURCE 3: Jobicy (free, no key) — remote jobs
  // ═══════════════════════════════════════════════════════════
  try {
    const diag = { source: "Jobicy", raw: 0, kept: 0, dropped_location: 0, dropped_title: 0, dropped_date: 0 };
    const tags = terms
      .map(t => t.toLowerCase().replace(/\s+/g,"-"))
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
        diag.raw++;
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
          description: (job.jobExcerpt || "").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().substring(0, 600),
          tags: job.jobIndustry ? [job.jobIndustry] : [],
          salary: job.annualSalaryMin && job.annualSalaryMax
            ? `$${(job.annualSalaryMin/1000).toFixed(0)}k-$${(job.annualSalaryMax/1000).toFixed(0)}k`
            : "Not listed",
          url: job.url || "",
          source: "jobicy.com",
        };
        if (applyFilters(j, diag)) { allJobs.push(j); diag.kept++; }
      }
    }
    diagnostics.push(diag);
    if (diag.kept > 0) activeSources.push("Jobicy");
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

  // If we filtered out everything, surface a helpful message
  const totalRaw = diagnostics.reduce((a, d) => a + d.raw, 0);
  const noResultsReason =
    unique.length === 0 && totalRaw > 0
      ? `Found ${totalRaw} raw results but all were filtered out. Try loosening location or title filters.`
      : null;

  return res.status(200).json({
    jobs: unique,
    count: unique.length,
    sources: [...new Set(activeSources)],
    hasRapidAPI: !!rapidKey,
    errors: errors.length > 0 ? errors : undefined,
    diagnostics,
    noResultsReason,
    query,
    searchGroups: terms.length,
    resolvedLocation: locInfo,
  });
}
