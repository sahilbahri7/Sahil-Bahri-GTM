// Job search — aggregates REAL jobs from multiple verified sources.
// Accepts either a string or an ARRAY of keywords and an optional `sources`
// array to restrict which providers are queried.
//
// Design notes:
// - Filters are LENIENT: location matches country/province/city hints
// - Title filter matches against title OR description (ANY token)
// - Per-source diagnostics surface where results are dropped
// - Upwork is queried TWICE (regular JSearch + a site:upwork.com biased
//   JSearch query) to get far better coverage than generic aggregation

// ─── Location intelligence ────────────────────────────────────────
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
  if (["remote","anywhere","worldwide","global"].includes(l)) return { kind: "remote", label: l };
  if (COUNTRY_META[l]) return { kind: "country", label: l, ...COUNTRY_META[l] };
  return { kind: "freeform", label: l, hints: [l] };
};

// Parse RSS 2.0 with regex — tiny and good enough for Upwork's feed
const parseRss = (xml) => {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml))) {
    const body = m[1];
    const pick = (tag) => {
      const mm = body.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
      if (!mm) return "";
      return mm[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
    };
    items.push({
      title: pick("title"),
      link: pick("link"),
      description: pick("description"),
      pubDate: pick("pubDate"),
      guid: pick("guid"),
      category: pick("category"),
    });
  }
  return items;
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = req.body || {};
  // Accept `keywords` as array of tags OR string (comma/whitespace-separated)
  let terms = [];
  if (Array.isArray(body.keywords)) {
    terms = body.keywords.map(t => String(t || "").trim()).filter(Boolean);
  } else {
    const s = (body.keywords || "CRM HubSpot Salesforce marketing operations consulting automation").trim();
    terms = s.includes(",")
      ? s.split(",").map(t => t.trim()).filter(t => t.length > 1)
      : s.split(/\s+/).map(t => t.trim()).filter(t => t.length > 1);
  }
  if (terms.length === 0) terms = ["CRM"];

  // Title filter — accept array of tokens or string
  let titleTokens = [];
  if (Array.isArray(body.title)) {
    titleTokens = body.title.map(t => String(t || "").toLowerCase().trim()).filter(t => t.length > 1);
  } else {
    const t = (body.title || "").toLowerCase().trim();
    titleTokens = t.split(/[\s,;/|]+/).map(x => x.trim()).filter(x => x.length > 1);
  }

  const loc = (body.location || "").trim();
  const locInfo = resolveLocation(loc);
  const effectiveDate = ["today","3days","week","month","all"].includes(body.datePosted) ? body.datePosted : "all";

  // Source gating — default all
  const ALL_SOURCES = ["JSearch","Upwork","Remotive","Jobicy","Arbeitnow","The Muse","RemoteOK"];
  const requested = Array.isArray(body.sources) && body.sources.length > 0
    ? new Set(body.sources)
    : new Set(ALL_SOURCES);
  const want = (s) => requested.has(s);

  const allJobs = [];
  const errors = [];
  const diagnostics = [];
  const activeSources = [];
  const seenIds = new Set();

  // ─── Filter helpers ─────────────────────────────────────────────
  const titleMatch = (job) => {
    if (titleTokens.length === 0) return true;
    const hay = ((job.title || "") + " " + (job.description || "")).toLowerCase();
    return titleTokens.some(t => hay.includes(t));
  };
  const locMatch = (job) => {
    if (!locInfo) return true;
    const jl = (job.location || "").toLowerCase();
    if (!jl) return true;
    if (locInfo.kind === "remote") return /remote|worldwide|anywhere|global/i.test(jl);
    if (locInfo.hints.some(h => jl.includes(h))) return true;
    if (/worldwide|anywhere/i.test(jl) || jl === "remote") return true;
    return false;
  };
  const dateMatch = (job) => {
    if (effectiveDate === "all") return true;
    if (!job._postedDate) return true;
    const diffDays = (Date.now() - new Date(job._postedDate).getTime()) / 86400000;
    if (effectiveDate === "today") return diffDays <= 1;
    if (effectiveDate === "3days") return diffDays <= 3;
    if (effectiveDate === "week")  return diffDays <= 7;
    if (effectiveDate === "month") return diffDays <= 31;
    return true;
  };
  const applyFilters = (job, diag) => {
    if (!dateMatch(job)) { diag.dropped_date++; return false; }
    if (!locMatch(job))  { diag.dropped_location++; return false; }
    if (!titleMatch(job)){ diag.dropped_title++; return false; }
    return true;
  };

  // ─── Normalizer for JSearch responses ──────────────────────────
  const normalizeJSearchJob = (j, overridePlatform) => ({
    id: `jsearch_${j.job_id}`,
    title: j.job_title || "",
    company: j.employer_name || "Unknown",
    companyLogo: j.employer_logo || null,
    companyWebsite: j.employer_website || null,
    platform: overridePlatform || j.job_publisher || "Indeed",
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
    description: (j.job_description || "").substring(0, 800).replace(/\n+/g," "),
    tags: [j.job_employment_type, ...(j.job_required_skills || [])].filter(Boolean).slice(0, 6),
    salary: j.job_min_salary && j.job_max_salary
      ? `$${Math.round(j.job_min_salary/1000)}k-$${Math.round(j.job_max_salary/1000)}k`
      : j.job_salary_period
      ? `${j.job_salary_currency || "$"}${j.job_min_salary || "?"}/${j.job_salary_period}`
      : "Not listed",
    url: j.job_apply_link || j.job_google_link || "",
    applyUrl: j.job_apply_link || j.job_google_link || "",
    source: (j.job_publisher || "jsearch").toLowerCase(),
  });

  const rapidKey = process.env.RevoSys_RapidAPI;

  // ═══════════════════════════════════════════════════════════
  // JSearch — per-keyword queries, up to 3 pages each
  // Covers LinkedIn, Indeed, Glassdoor, ZipRecruiter, Upwork
  // ═══════════════════════════════════════════════════════════
  if (rapidKey && want("JSearch")) {
    const diag = { source: "JSearch", raw: 0, kept: 0, dropped_location: 0, dropped_title: 0, dropped_date: 0 };
    const titleBias = titleTokens.length ? " " + titleTokens.slice(0, 2).join(" ") : "";

    const buildParams = (kw, extra = "") => {
      const params = new URLSearchParams({
        query: `${kw}${titleBias}${extra}`.trim(),
        page: "1",
        num_pages: "3",
        date_posted: effectiveDate,
      });
      if (locInfo?.kind === "remote") params.set("remote_jobs_only", "true");
      else if (locInfo?.kind === "country" && locInfo.code) params.set("country", locInfo.code);
      else if (locInfo?.kind === "freeform") params.set("query", `${kw}${titleBias}${extra} in ${locInfo.label}`.trim());
      return params;
    };

    const callJSearch = async (params, tag) => {
      try {
        const r = await fetch(`https://jsearch.p.rapidapi.com/search?${params}`, {
          headers: { "X-RapidAPI-Key": rapidKey, "X-RapidAPI-Host": "jsearch.p.rapidapi.com" },
          signal: AbortSignal.timeout(22000),
        });
        if (r.ok) return { data: (await r.json()).data || [], tag };
        const err = await r.text().catch(() => "");
        return { error: `HTTP ${r.status}: ${err.substring(0, 180)}`, tag };
      } catch (e) { return { error: e.message, tag }; }
    };

    // One query per keyword (first 5 keywords)
    const primary = terms.slice(0, 5).map(kw => callJSearch(buildParams(kw), `primary:${kw}`));

    // Upwork-biased queries (site:upwork.com) — only if Upwork is requested
    const upworkCalls = want("Upwork")
      ? terms.slice(0, 3).map(kw => callJSearch(buildParams(kw, " site:upwork.com"), `upwork:${kw}`))
      : [];

    const results = await Promise.all([...primary, ...upworkCalls]);
    const publisherSet = new Set();

    for (const result of results) {
      if (result.error) {
        errors.push({ source: "JSearch", error: result.error, query: result.tag });
        continue;
      }
      const isUpworkTag = result.tag.startsWith("upwork:");
      for (const job of result.data) {
        if (seenIds.has(job.job_id)) continue;
        seenIds.add(job.job_id);
        diag.raw++;
        // Override platform label to "Upwork" when it came from the site:upwork query
        const isUpwork = isUpworkTag || /upwork/i.test(job.employer_name || "") || /upwork/i.test(job.job_publisher || "") || /upwork\.com/i.test(job.job_apply_link || "");
        const j = normalizeJSearchJob(job, isUpwork ? "Upwork" : undefined);
        if (applyFilters(j, diag)) {
          allJobs.push(j);
          diag.kept++;
          publisherSet.add(j.platform);
        }
      }
    }

    diagnostics.push(diag);
    if (publisherSet.size > 0) activeSources.push(...publisherSet);
  } else if (!rapidKey) {
    errors.push({ source: "JSearch", error: "RevoSys_RapidAPI key not configured" });
  }

  // ═══════════════════════════════════════════════════════════
  // Upwork RSS — public feed, per keyword, sorted by recency
  // ═══════════════════════════════════════════════════════════
  if (want("Upwork")) {
    const diag = { source: "Upwork RSS", raw: 0, kept: 0, dropped_location: 0, dropped_title: 0, dropped_date: 0 };
    const upworkPromises = terms.slice(0, 4).map(async (kw) => {
      try {
        const url = `https://www.upwork.com/ab/feed/jobs/rss?q=${encodeURIComponent(kw)}&sort=recency&paging=0%3B50`;
        const r = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; RevoSysBot/1.0)", Accept: "application/rss+xml,application/xml,text/xml" },
          signal: AbortSignal.timeout(10000),
        });
        if (r.ok) return { xml: await r.text(), kw };
        return { error: `HTTP ${r.status}`, kw };
      } catch (e) { return { error: e.message, kw }; }
    });

    const rssResults = await Promise.all(upworkPromises);
    const upworkSeen = new Set();
    for (const result of rssResults) {
      if (result.error) { errors.push({ source: "Upwork RSS", error: result.error, query: result.kw }); continue; }
      const items = parseRss(result.xml || "");
      for (const item of items) {
        const id = item.guid || item.link;
        if (!id || upworkSeen.has(id)) continue;
        upworkSeen.add(id);
        diag.raw++;
        // Description contains HTML incl. "Budget" / "Hourly Range" strings
        const descClean = (item.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        const budgetMatch = descClean.match(/(?:Hourly Range|Budget):?\s*([^\n]{0,60})/i);
        const postedDate = item.pubDate ? new Date(item.pubDate).toISOString() : null;
        const j = {
          id: `upwork_rss_${id.split("_").pop() || id.substring(0, 40)}`,
          title: item.title.replace(/ - Upwork$/i, "").trim(),
          company: "Upwork Client",
          companyLogo: null,
          companyWebsite: null,
          platform: "Upwork",
          type: "Contract",
          location: "Remote",
          posted: item.pubDate ? new Date(item.pubDate).toLocaleDateString() : "Recent",
          _postedDate: postedDate,
          description: descClean.substring(0, 800),
          tags: item.category ? [item.category] : [],
          salary: budgetMatch ? budgetMatch[1].trim() : "Not listed",
          url: item.link,
          applyUrl: item.link,
          source: "upwork.com",
        };
        if (applyFilters(j, diag)) { allJobs.push(j); diag.kept++; }
      }
    }
    diagnostics.push(diag);
    if (diag.kept > 0) activeSources.push("Upwork");
  }

  // ═══════════════════════════════════════════════════════════
  // Remotive
  // ═══════════════════════════════════════════════════════════
  if (want("Remotive")) {
    try {
      const diag = { source: "Remotive", raw: 0, kept: 0, dropped_location: 0, dropped_title: 0, dropped_date: 0 };
      const searchTerms = terms.slice(0, 5).map(t => t.toLowerCase());
      const remotiveSeen = new Set();
      const remotivePromises = searchTerms.map(async (term) => {
        try {
          const r = await fetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(term)}&limit=30`,
            { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
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
            description: (job.description || "").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().substring(0, 800),
            tags: job.tags || [],
            salary: job.salary || "Not listed",
            url: job.url || "",
            applyUrl: job.url || "",
            source: "remotive.com",
          };
          if (applyFilters(j, diag)) { allJobs.push(j); diag.kept++; }
        }
      }
      diagnostics.push(diag);
      if (diag.kept > 0) activeSources.push("Remotive");
    } catch (e) { errors.push({ source: "Remotive", error: e.message }); }
  }

  // ═══════════════════════════════════════════════════════════
  // Jobicy
  // ═══════════════════════════════════════════════════════════
  if (want("Jobicy")) {
    try {
      const diag = { source: "Jobicy", raw: 0, kept: 0, dropped_location: 0, dropped_title: 0, dropped_date: 0 };
      const tags = terms.map(t => t.toLowerCase().replace(/\s+/g,"-")).filter(t => t.length > 2).slice(0, 5).join(",");
      const r = await fetch(`https://jobicy.com/api/v2/remote-jobs?count=50&tag=${encodeURIComponent(tags || "crm,marketing,sales")}`,
        { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
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
            description: (job.jobExcerpt || "").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().substring(0, 800),
            tags: job.jobIndustry ? [job.jobIndustry] : [],
            salary: job.annualSalaryMin && job.annualSalaryMax
              ? `$${(job.annualSalaryMin/1000).toFixed(0)}k-$${(job.annualSalaryMax/1000).toFixed(0)}k`
              : "Not listed",
            url: job.url || "",
            applyUrl: job.url || "",
            source: "jobicy.com",
          };
          if (applyFilters(j, diag)) { allJobs.push(j); diag.kept++; }
        }
      }
      diagnostics.push(diag);
      if (diag.kept > 0) activeSources.push("Jobicy");
    } catch (e) { errors.push({ source: "Jobicy", error: e.message }); }
  }

  // ═══════════════════════════════════════════════════════════
  // Arbeitnow
  // ═══════════════════════════════════════════════════════════
  if (want("Arbeitnow")) {
    try {
      const diag = { source: "Arbeitnow", raw: 0, kept: 0, dropped_location: 0, dropped_title: 0, dropped_date: 0 };
      const r = await fetch("https://www.arbeitnow.com/api/job-board-api",
        { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
      if (r.ok) {
        const d = await r.json();
        const kw = terms.map(t => t.toLowerCase());
        for (const job of (d.data || []).slice(0, 150)) {
          const hay = `${job.title || ""} ${job.description || ""} ${(job.tags || []).join(" ")}`.toLowerCase();
          if (!kw.some(k => hay.includes(k))) continue;
          diag.raw++;
          const j = {
            id: `arbeitnow_${job.slug}`,
            title: job.title || "",
            company: job.company_name || "Unknown",
            companyLogo: null,
            companyWebsite: null,
            platform: "Arbeitnow",
            type: (job.job_types && job.job_types[0]) ? job.job_types[0].replace(/_/g, " ") : "Full-time",
            location: job.remote ? "Remote" : (job.location || "Not specified"),
            posted: job.created_at ? new Date(job.created_at * 1000).toLocaleDateString() : "Recent",
            _postedDate: job.created_at ? new Date(job.created_at * 1000).toISOString() : null,
            description: (job.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().substring(0, 800),
            tags: job.tags || [],
            salary: "Not listed",
            url: job.url || "",
            applyUrl: job.url || "",
            source: "arbeitnow.com",
          };
          if (applyFilters(j, diag)) { allJobs.push(j); diag.kept++; }
        }
      }
      diagnostics.push(diag);
      if (diag.kept > 0) activeSources.push("Arbeitnow");
    } catch (e) { errors.push({ source: "Arbeitnow", error: e.message }); }
  }

  // ═══════════════════════════════════════════════════════════
  // The Muse
  // ═══════════════════════════════════════════════════════════
  if (want("The Muse")) {
    try {
      const diag = { source: "The Muse", raw: 0, kept: 0, dropped_location: 0, dropped_title: 0, dropped_date: 0 };
      const categories = ["Operations","Sales","Marketing","Data Science"];
      const musePromises = categories.map(async (cat) => {
        try {
          const url = `https://www.themuse.com/api/public/jobs?category=${encodeURIComponent(cat)}&page=0&descending=true`;
          const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
          if (r.ok) return (await r.json()).results || [];
          return [];
        } catch { return []; }
      });
      const museResults = await Promise.all(musePromises);
      const kw = terms.map(t => t.toLowerCase());
      const museSeen = new Set();
      for (const list of museResults) {
        for (const job of list) {
          if (museSeen.has(job.id)) continue;
          museSeen.add(job.id);
          const hay = `${job.name || ""} ${job.contents || ""}`.toLowerCase();
          if (!kw.some(k => hay.includes(k))) continue;
          diag.raw++;
          const locStr = (job.locations || []).map(l => l.name).join(", ") || "Not specified";
          const j = {
            id: `muse_${job.id}`,
            title: job.name || "",
            company: job.company?.name || "Unknown",
            companyLogo: null,
            companyWebsite: null,
            platform: "The Muse",
            type: job.type || "Full-time",
            location: locStr,
            posted: job.publication_date ? new Date(job.publication_date).toLocaleDateString() : "Recent",
            _postedDate: job.publication_date || null,
            description: (job.contents || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().substring(0, 800),
            tags: (job.levels || []).map(l => l.name),
            salary: "Not listed",
            url: job.refs?.landing_page || "",
            applyUrl: job.refs?.landing_page || "",
            source: "themuse.com",
          };
          if (applyFilters(j, diag)) { allJobs.push(j); diag.kept++; }
        }
      }
      diagnostics.push(diag);
      if (diag.kept > 0) activeSources.push("The Muse");
    } catch (e) { errors.push({ source: "The Muse", error: e.message }); }
  }

  // ═══════════════════════════════════════════════════════════
  // RemoteOK
  // ═══════════════════════════════════════════════════════════
  if (want("RemoteOK")) {
    try {
      const diag = { source: "RemoteOK", raw: 0, kept: 0, dropped_location: 0, dropped_title: 0, dropped_date: 0 };
      const r = await fetch("https://remoteok.com/api", {
        headers: { Accept: "application/json", "User-Agent": "Revo-Sys-JobFinder/1.0" },
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) {
        const d = await r.json();
        const list = Array.isArray(d) ? d.filter(x => x.id) : [];
        const kw = terms.map(t => t.toLowerCase());
        for (const job of list.slice(0, 150)) {
          const hay = `${job.position || ""} ${job.description || ""} ${(job.tags || []).join(" ")}`.toLowerCase();
          if (!kw.some(k => hay.includes(k))) continue;
          diag.raw++;
          const j = {
            id: `remoteok_${job.id}`,
            title: job.position || "",
            company: job.company || "Unknown",
            companyLogo: job.company_logo || job.logo || null,
            companyWebsite: null,
            platform: "RemoteOK",
            type: "Remote",
            location: job.location || "Remote",
            posted: job.date ? new Date(job.date).toLocaleDateString() : "Recent",
            _postedDate: job.date || null,
            description: (job.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().substring(0, 800),
            tags: job.tags || [],
            salary: job.salary_min && job.salary_max
              ? `$${Math.round(job.salary_min/1000)}k-$${Math.round(job.salary_max/1000)}k`
              : "Not listed",
            url: job.url || job.apply_url || "",
            applyUrl: job.apply_url || job.url || "",
            source: "remoteok.com",
          };
          if (applyFilters(j, diag)) { allJobs.push(j); diag.kept++; }
        }
      }
      diagnostics.push(diag);
      if (diag.kept > 0) activeSources.push("RemoteOK");
    } catch (e) { errors.push({ source: "RemoteOK", error: e.message }); }
  }

  // Dedup by normalized title+company
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

  const totalRaw = diagnostics.reduce((a, d) => a + d.raw, 0);
  const noResultsReason = unique.length === 0 && totalRaw > 0
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
    keywords: terms,
    sourcesRequested: [...requested],
    resolvedLocation: locInfo,
  });
}
