const { Readable } = require("stream");
const btch = require("btch-downloader");
const { PLATFORMS } = require("../config/platforms");
const ApiError = require("../utils/ApiError");

/*
 Official btch-downloader documentation & project links:
 - GitHub: https://github.com/hostinger-bot/btch-downloader
 - npm:    https://www.npmjs.com/package/btch-downloader

 Notes:
 - The controller uses the btch-downloader package (see links above) and
   delegates platform-specific work to the library's exported functions.
 - See the library README for details about the `aio` (auto-detect) function
   and supported URL formats.
*/

// Log at startup which expected downloader functions are available vs missing.
(function logAvailableDownloaders() {
  try {
    const available = Object.keys(btch).filter((k) => typeof btch[k] === "function");
    const expected = Object.values(PLATFORMS).map((p) => p.fn);
    const missing = expected.filter((fn) => !available.includes(fn));
    if (missing.length) {
      console.warn("btch-downloader: missing expected functions:", missing);
    }
    console.debug("btch-downloader: available functions:", available);
  } catch (e) {
    console.warn("btch-downloader: could not inspect exports", e.message);
  }
})();

/**
 * GET /api/platforms
 * Returns the list of supported platforms — used by the frontend to build its dropdown.
 * Only returns platforms for which the underlying btch-downloader package exposes the
 * configured function. This avoids advertising routes that will 404 at runtime.
 */
function listPlatforms(req, res) {
  const platforms = Object.entries(PLATFORMS)
    .filter(([key, cfg]) => typeof btch[cfg.fn] === "function")
    .map(([key, value]) => ({
      key,
      queryType: value.queryType,
      example: value.example,
      ...(value.note ? { note: value.note } : {}),
    }));
  res.json({ success: true, count: platforms.length, platforms });
}

/**
 * Helper: normalize known URL forms that btch-downloader expects in a specific shape.
 * Currently normalizes YouTube "shorts" and youtu.be short links to the canonical
 * https://www.youtube.com/watch?v=<id> form.
 */
function normalizeInputForDownloader(input) {
  let v = String(input || "").trim();
  if (!v) return v;

  // Normalize youtu.be/<id> -> https://www.youtube.com/watch?v=<id>
  v = v.replace(/^(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^?&/]+).*$/i, "https://www.youtube.com/watch?v=$1");

  // Normalize youtube.com/shorts/<id> -> https://www.youtube.com/watch?v=<id>
  v = v.replace(/^(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([^?&/]+).*$/i, "https://www.youtube.com/watch?v=$1");

  return v;
}

/**
 * GET /api/download/:platform?url=...  (or ?query=... for search-based platforms)
 * Generic handler shared by every platform route.
 */
async function download(req, res) {
  const { platform } = req.params;
  const input = req.query.url || req.query.query;

  const config = PLATFORMS[platform];
  if (!config) {
    throw new ApiError(404, `Unsupported platform "${platform}".`);
  }

  if (!input || !input.trim()) {
    const paramName = config.queryType === "query" ? "query" : "url";
    throw new ApiError(400, `Missing required "${paramName}" query parameter. Example: ${config.example}`);
  }

  const fn = btch[config.fn];
  if (typeof fn !== "function") {
    // Provide a clearer message including available functions for debugging.
    const available = Object.keys(btch).filter((k) => typeof btch[k] === "function");
    throw new ApiError(404, `Downloader function "${config.fn}" is not available in btch-downloader. Available: ${available.join(", ")}`);
  }

  // Normalize a few common URL shapes so downstream downloaders (like YouTube)
  // receive the canonical form they expect and avoid confusing errors such as
  // "Invalid search API response" when callers pass a shorts/ or youtu.be link.
  const rawQuery = input.trim();
  let normalizedQuery = rawQuery;
  // Only apply the YouTube normalizations when the platform is youtube or aio —
  // aio delegates to platform-specific downloaders and benefits from the same fix.
  if (/(youtube|aio)/i.test(platform)) {
    normalizedQuery = normalizeInputForDownloader(rawQuery);
  }

  const data = await fn(normalizedQuery);

  // btch-downloader sometimes returns an object containing an `error` property
  // or a `status: false` result instead of throwing. Map those to a consistent
  // API error response so clients get a helpful message and proper HTTP status.
  if (data && (data.error || data.status === false || data.success === false)) {
    const message =
      (typeof data.error === "string" && data.error) ||
      (data.error && data.error.message) ||
      "Downloader returned an error";
    throw new ApiError(502, message);
  }

  res.json({
    success: true,
    platform,
    query: rawQuery,
    result: data,
  });
}

/**
 * Blocks obvious loopback/private/link-local hosts so /api/fetch-media can't
 * be used as an open proxy to reach internal network services. Best-effort
 * (string-based, not DNS-resolved) — good enough against casual misuse.
 */
function isPrivateHostname(hostname) {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "::1") return true;
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  if (h === "0.0.0.0") return true;
  return false;
}

/**
 * Maps a real (upstream) Content-Type to a file extension. Used instead of
 * guessing from the URL, since many CDN links (e.g. YouTube's googlevideo.com
 * playback URLs) carry no file extension in the path at all.
 */
const EXT_BY_MIME = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

/**
 * Content-Types that indicate the upstream did NOT actually hand us media —
 * typically an error/interstitial page from a CDN that rejected the request
 * (missing Referer/User-Agent, expired signed URL, geo-block, etc). Forwarding
 * these as if they were the real file is exactly the "downloads a tiny raw
 * file that needs manual renaming" bug — so we treat them as failures instead.
 */
function looksLikeFailurePayload(contentType) {
  return /^(text\/html|application\/json|text\/plain)\b/i.test(contentType || "");
}

/**
 * GET /api/fetch-media?url=...&filename=...
 * Streams a direct media URL (as returned inside a /api/download result) back
 * through this server with a Content-Disposition header, so a browser click
 * triggers a real file save instead of navigating to/opening the raw CDN URL.
 * This also sidesteps CDNs that don't set download-friendly headers themselves,
 * and avoids exposing the raw source URL directly to the client's tab history.
 */
async function fetchMedia(req, res) {
  const { url, filename } = req.query;

  if (!url || !url.trim()) {
    throw new ApiError(400, 'Missing required "url" query parameter.');
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new ApiError(400, "Invalid media URL.");
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new ApiError(400, "Only http/https media URLs are supported.");
  }
  if (isPrivateHostname(parsed.hostname)) {
    throw new ApiError(400, "Refusing to fetch a private/internal address.");
  }

  // Many CDNs (YouTube's googlevideo.com in particular) reject requests that
  // don't look like they came from a browser, or that lack a matching Referer.
  // Without these, the CDN can respond 200 with a small HTML/JSON error body
  // instead of the media — which is exactly what was getting silently saved
  // as a "broken" file before.
  const upstream = await fetch(parsed.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "*/*",
      Referer: `${parsed.protocol}//${parsed.host}/`,
    },
  });

  if (!upstream.ok || !upstream.body) {
    throw new ApiError(502, `Upstream media host returned ${upstream.status}.`);
  }

  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  const contentLength = upstream.headers.get("content-length");

  if (looksLikeFailurePayload(contentType)) {
    // The upstream responded 200 but the body isn't actually media — most
    // likely a block page or error response. Fail loudly instead of handing
    // the client a garbage file.
    throw new ApiError(502, "Upstream did not return a media file (got a text/HTML/JSON response instead).");
  }

  const baseName = (filename && filename.trim().replace(/[^a-zA-Z0-9._-]/g, "_")) ||
    (parsed.pathname.split("/").pop() || "download").replace(/\.[a-z0-9]+$/i, "");

  // Determine the real extension from the actual response Content-Type,
  // ignoring whatever extension (if any) the client guessed beforehand.
  const mimeBase = contentType.split(";")[0].trim().toLowerCase();
  const ext = EXT_BY_MIME[mimeBase];
  const safeName = ext ? `${baseName.replace(/\.[a-z0-9]+$/i, "")}.${ext}` : baseName;

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
  if (contentLength) res.setHeader("Content-Length", contentLength);

  Readable.fromWeb(upstream.body).pipe(res);
}

module.exports = { listPlatforms, download, fetchMedia };
