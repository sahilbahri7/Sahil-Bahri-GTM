// Scrape a URL and return text content + metadata + brand palette.
// Used by Job Finder to extract client branding so we can personalize
// scopes/assets (Pomelli-style: pick up the client's colors and logo).

// Extract brand colors from HTML / inline CSS
const extractBrand = (html, baseUrl) => {
  const norm = (u) => {
    if (!u) return null;
    try { return new URL(u, baseUrl).href; } catch { return u; }
  };

  // theme-color meta
  const themeColor = html.match(/<meta[^>]*name=["']theme-color["'][^>]*content=["']([^"']+)["']/i)?.[1] || null;

  // Apple mask icon (sometimes the one brand color a site exposes)
  const maskColor = html.match(/<meta[^>]*name=["']msapplication-TileColor["'][^>]*content=["']([^"']+)["']/i)?.[1] || null;

  // Favicon / apple-touch-icon
  const faviconRaw = html.match(/<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i)?.[1]
    || html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:icon|shortcut icon)["']/i)?.[1]
    || null;
  const appleIconRaw = html.match(/<link[^>]*rel=["']apple-touch-icon(?:-precomposed)?["'][^>]*href=["']([^"']+)["']/i)?.[1]
    || html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']apple-touch-icon(?:-precomposed)?["']/i)?.[1]
    || null;

  // og:image often a branded marketing card
  const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1] || null;

  // Gather hex colors from inline styles + <style> blocks
  const stylesHtml = [
    ...(html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || []),
    ...(html.match(/style=["'][^"']*["']/gi) || []),
  ].join(" ");

  // Count hex-color occurrences (#fff, #ffffff)
  const counts = new Map();
  const hexRe = /#(?:[0-9a-fA-F]{3}){1,2}(?![0-9a-fA-F])/g;
  let m;
  while ((m = hexRe.exec(stylesHtml))) {
    let hex = m[0].toLowerCase();
    if (hex.length === 4) hex = "#" + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    // Skip pure grayscale/white/black — we want brand accent
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    const grayish = Math.abs(r-g) < 12 && Math.abs(g-b) < 12 && Math.abs(r-b) < 12;
    if (grayish) continue;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    if (saturation < 0.2) continue; // too washed out
    counts.set(hex, (counts.get(hex) || 0) + 1);
  }

  // Top 3 candidate colors by frequency
  const ranked = [...counts.entries()].sort((a,b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
  const primary = themeColor || ranked[0] || null;
  const accent = ranked.find(c => c !== primary) || primary;

  return {
    primary,
    accent,
    themeColor,
    msTileColor: maskColor,
    palette: ranked,
    favicon: norm(faviconRaw),
    appleIcon: norm(appleIconRaw),
    logo: norm(appleIconRaw) || norm(faviconRaw),
    ogImage: norm(ogImage),
  };
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: "Missing url" });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RevoSysBot/1.0; +https://revosys.pro)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!r.ok) return res.status(r.status).json({ error: `Failed to fetch: HTTP ${r.status}` });

    const html = await r.text();
    const finalUrl = r.url || url;

    // Metadata
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";
    const description = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i)?.[1]?.trim() || "";
    const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([\s\S]*?)["']/i)?.[1] || "";
    const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([\s\S]*?)["']/i)?.[1] || "";
    const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([\s\S]*?)["']/i)?.[1] || "";

    const brand = extractBrand(html, finalUrl);

    // Strip HTML for text body
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#\d+;/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (text.length > 4000) text = text.substring(0, 4000) + "...";

    return res.status(200).json({
      url: finalUrl,
      title,
      description,
      ogTitle,
      ogDesc,
      ogImage,
      text,
      brand,
    });
  } catch (err) {
    if (err.name === "AbortError") return res.status(504).json({ error: "Request timed out" });
    return res.status(500).json({ error: err.message || "Scrape failed" });
  }
}
