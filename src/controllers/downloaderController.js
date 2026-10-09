const { Readable } = require("stream");
const btch = require("btch-downloader");
const { PLATFORMS } = require("../config/platforms");
const ApiError = require("../utils/ApiError");
const { requireInputForQueryType, requireHttpUrl, requireNonEmptyString } = require("../utils/validate");
const withTimeout = require("../utils/withTimeout");
const { normalizeResult, truncateListResult, hasHandler } = require("../utils/normalizeResult");

// Applies to platforms with `supportsLimit: true` (youtube-search, pinterest
// search) — these can return dozens of hits per query, most of which nobody
// asked for. Defaults to a small, sane page size and caps how high a caller
// can push it, rather than shipping (and letting the client render) an
// unbounded list on every request.
const LIST_LIMIT_DEFAULT = 5;
const LIST_LIMIT_MAX = 50;

function parseLimit(rawLimit) {
  const n = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(n) || n < 1) return LIST_LIMIT_DEFAULT;
  return Math.min(n, LIST_LIMIT_MAX);
}

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
      ...(value.deprecated ? { deprecated: true } : {}),
      ...(value.supportsLimit ? { supportsLimit: true } : {}),
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
 * YouTube: pull the 11-char video id out of any common URL shape (watch,
 * youtu.be, shorts, embed, live) so we can rebuild clean URLs without
 * tracking params like ?si=... that some upstream scrapers choke on.
 */
function extractYouTubeId(input) {
  const m = String(input || "").match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([A-Za-z0-9_-]{11})/i
  );
  return m ? m[1] : null;
}

function extractInstagramShortcode(input) {
  const m = String(input || "").match(/(?:instagram\.com|instagr\.am)\/(?:p|reel|reels|tv|stories|share)\/([A-Za-z0-9_-]+)/i);
  return m ? m[1] : null;
}

async function expandThreadsUrl(inputUrl) {
  let url = String(inputUrl || "").trim();
  if (!url) return url;
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  if (/(?:threads\.com|threads\.net)\/(?:share|t)\//i.test(url)) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res && res.url && res.url !== url) {
        url = res.url;
      }
    } catch (_) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(url, {
          method: "GET",
          redirect: "follow",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          },
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res && res.url && res.url !== url) {
          url = res.url;
        }
      } catch (__) {}
    }
  }
  return url;
}

async function scrapeThreadsDirectly(inputUrl) {
  try {
    const res = await fetch(inputUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();

    const media = [];
    const videoVersionsMatches = html.match(/"video_versions":\s*(\[[^\]]+\])/g) || [];
    for (const matchStr of videoVersionsMatches) {
      try {
        const jsonStr = matchStr.replace(/"video_versions":\s*/, "");
        const versions = JSON.parse(jsonStr);
        if (Array.isArray(versions)) {
          versions.forEach((v) => {
            if (v && v.url) {
              const cleanUrl = v.url.replace(/\\/g, "");
              if (!media.some((m) => m.url === cleanUrl)) {
                media.push({
                  label: v.width ? `Video (${v.width}x${v.height})` : "HD Video",
                  type: "video",
                  url: cleanUrl,
                });
              }
            }
          });
        }
      } catch (_) {}
    }

    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    const title = ogTitleMatch ? ogTitleMatch[1].replace(/&amp;/g, "&") : null;

    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    const thumbnail = ogImageMatch ? ogImageMatch[1].replace(/&amp;/g, "&") : (media[0] ? media[0].url : null);

    if (!media.length) return null;

    return {
      status: true,
      title,
      thumbnail,
      result: {
        status: true,
        type: "video",
        video: media[0].url,
        media,
      },
    };
  } catch (e) {
    return null;
  }
}

async function buildCandidates(platform, rawQuery, normalizedQuery) {
  if (platform === "youtube") {
    const id = extractYouTubeId(rawQuery);
    const list = id
      ? [`https://youtube.com/watch?v=${id}`, `https://www.youtube.com/watch?v=${id}`, rawQuery]
      : [normalizedQuery, rawQuery];
    return [...new Set(list)];
  }

  if (platform === "instagram") {
    const code = extractInstagramShortcode(rawQuery);
    const cleanUrl = rawQuery.split("?")[0];
    const list = code
      ? [
          cleanUrl,
          rawQuery,
          `https://www.instagram.com/reel/${code}/`,
          `https://www.instagram.com/p/${code}/`,
          `https://www.instagram.com/tv/${code}/`,
        ]
      : [cleanUrl, rawQuery];
    return [...new Set(list.filter(Boolean))];
  }

  if (platform === "threads" || /(threads\.com|threads\.net)/i.test(rawQuery)) {
    const expanded = await expandThreadsUrl(rawQuery);
    const cleanExpanded = expanded.split("?")[0];
    const threadsComClean = cleanExpanded.replace(/threads\.net/i, "threads.com");
    const threadsNetClean = cleanExpanded.replace(/threads\.com/i, "threads.net");

    const list = [threadsComClean, threadsNetClean, cleanExpanded, expanded, rawQuery];
    return [...new Set(list.filter(Boolean))];
  }

  return [normalizedQuery];
}

// Platforms whose success means "there are downloadable links". An empty
// result from these is a failure, not a success. (Search platforms can
// legitimately return nothing, so they're excluded.)
const LIST_PLATFORMS = new Set(["youtube-search", "pinterest"]);

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

  const paramName = config.queryType === "query" ? "query" : "url";
  if (input === undefined) {
    throw new ApiError(400, `Missing required "${paramName}" query parameter. Example: ${config.example}`);
  }
  const rawQuery = requireInputForQueryType(input, config.queryType, paramName);

  const fn = btch[config.fn];
  if (typeof fn !== "function") {
    // Provide a clearer message including available functions for debugging.
    const available = Object.keys(btch).filter((k) => typeof btch[k] === "function");
    throw new ApiError(404, `Downloader function "${config.fn}" is not available in btch-downloader. Available: ${available.join(", ")}`);
  }

  // Normalize a few common URL shapes so downstream downloaders (like YouTube)
  // receive the canonical form they expect and avoid confusing errors such as
  // "Invalid search API response" when callers pass a shorts/ or youtu.be link.
  let normalizedQuery = rawQuery;
  // Only apply the YouTube normalizations when the platform is youtube or aio —
  // aio delegates to platform-specific downloaders and benefits from the same fix.
  if (/(youtube|aio)/i.test(platform)) {
    normalizedQuery = normalizeInputForDownloader(rawQuery);
  }

  const candidates = await buildCandidates(platform, rawQuery, normalizedQuery);
  const totalMs = Number(process.env.DOWNLOAD_TIMEOUT_MS) || 9_500;
  const candidateTimeoutMs = Math.min(totalMs - 500, 8_500);
  const guardTimeoutMs = Math.min(totalMs, 9_200);
  const mustHaveMedia = hasHandler(platform) && !LIST_PLATFORMS.has(platform);

  // Candidate evaluation in PARALLEL with a hard timeout guard
  const selectedCandidates = candidates.slice(0, 3);
  const tasks = [];

  for (const candidate of selectedCandidates) {
    // Primary downloader function
    tasks.push(
      withTimeout(
        fn(candidate),
        candidateTimeoutMs,
        `The ${platform} downloader took too long.`
      ).then((attempt) => {
        if (attempt && !attempt.error && attempt.status !== false && attempt.success !== false) {
          const attemptNormalized = normalizeResult(platform, attempt);
          if (attemptNormalized) return attempt;
        }
        throw new Error("No valid media found in candidate response.");
      })
    );

    // Direct HTML scraper fallback for Threads
    if (platform === "threads" && candidate === selectedCandidates[0]) {
      tasks.push(
        withTimeout(
          scrapeThreadsDirectly(candidate),
          candidateTimeoutMs,
          `The direct threads scraper took too long.`
        ).then((attempt) => {
          if (attempt && attempt.result) {
            const attemptNormalized = normalizeResult(platform, attempt);
            if (attemptNormalized) return attempt;
          }
          throw new Error("No valid media found in direct threads scrape.");
        })
      );
    }

    // Add btch.aio as a parallel fallback candidate for Instagram
    if (platform === "instagram" && typeof btch.aio === "function" && candidate === selectedCandidates[0]) {
      tasks.push(
        withTimeout(
          btch.aio(candidate),
          candidateTimeoutMs,
          `The instagram fallback downloader took too long.`
        ).then((attempt) => {
          if (attempt && !attempt.error && attempt.status !== false && attempt.success !== false) {
            const attemptNormalized = normalizeResult(platform, attempt);
            if (attemptNormalized) return attempt;
          }
          throw new Error("No valid media found in fallback response.");
        })
      );
    }
  }

  // Hard timeout guard
  const vercelGuardPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new ApiError(504, `The ${platform} downloader took too long to respond.`));
    }, guardTimeoutMs);
  });

  let data;
  try {
    data = await Promise.race([
      Promise.any(tasks),
      vercelGuardPromise,
    ]);
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(504, `The ${platform} downloader took too long or returned no media.`);
  }

  // For list-shaped platforms (search results), trim to `limit` (default 5,
  // capped at 50, via ?limit=) before it's ever normalized or sent back — so
  // the raw JSON and the normalized view agree, and a query that could
  // return dozens of hits doesn't ship (and force the client to render) all
  // of them by default.
  const appliedLimit = config.supportsLimit ? parseLimit(req.query.limit) : null;
  if (appliedLimit !== null) {
    truncateListResult(platform, data, appliedLimit);
  }

  res.json({
    success: true,
    platform,
    query: rawQuery,
    ...(appliedLimit !== null ? { limit: appliedLimit } : {}),
    // `result` stays exactly what the library returned (raw toggle / direct
    // API callers depend on that, aside from the ?limit= trim above).
    // `normalized` is a best-effort, consistent {kind, ...} view built from
    // real per-platform shapes (src/utils/normalizeResult.js) — null for
    // platforms without a handler yet, or if nothing usable was found; the
    // frontend falls back to its generic parser in that case.
    result: data,
    normalized: normalizeResult(platform, data),
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

  const parsedUrlString = requireHttpUrl(url, "url");
  if (filename && filename.trim()) {
    // Only validate when a real (non-empty) filename was actually given —
    // this stays an optional field with a derived fallback, same as before.
    requireNonEmptyString(filename, "filename", { maxLength: 255 });
  }

  const parsed = new URL(parsedUrlString);
  if (isPrivateHostname(parsed.hostname)) {
    throw new ApiError(400, "Refusing to fetch a private/internal address.");
  }

  // Many CDNs (YouTube's googlevideo.com in particular) reject requests that
  // don't look like they came from a browser, or that lack a matching Referer.
  // Without these, the CDN can respond 200 with a small HTML/JSON error body
  // instead of the media — which is exactly what was getting silently saved
  // as a "broken" file before.
  //
  // The abort timer only guards the connect + response-headers phase — it's
  // cleared the moment headers actually arrive, so a legitimately large file
  // that's slow-but-successfully streaming isn't killed partway through by
  // an arbitrary total-transfer cutoff.
  const controller = new AbortController();
  const connectTimeoutMs = Number(process.env.FETCH_MEDIA_TIMEOUT_MS) || 20_000;
  const timeoutTimer = setTimeout(() => controller.abort(), connectTimeoutMs);

  let upstream;
  try {
    upstream = await fetch(parsed.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "*/*",
        Referer: `${parsed.protocol}//${parsed.host}/`,
      },
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new ApiError(504, "Upstream media host took too long to respond.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutTimer);
  }

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
