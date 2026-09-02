const ApiError = require("./ApiError");

// Generous but bounded — real URLs and search queries are always far
// shorter than this. Mainly a defense against someone deliberately sending
// a huge string to waste CPU/memory in downstream parsing or logging.
const MAX_INPUT_LENGTH = 2000;

// Raw control characters (other than the whitespace already trimmed) have
// no legitimate place in a URL or search query, and are a common
// injection/log-smuggling vector if they end up in headers or log lines
// downstream — reject them outright rather than passing them through.
const CONTROL_CHAR_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;

/**
 * Validates a required string param: present, a real string, non-empty
 * after trimming, within a sane length, and free of control characters.
 * Throws a clean ApiError(400, ...) with a specific reason instead of
 * letting bad input reach the downloader library (which tends to fail
 * with a vague upstream error) or any later code that assumes a clean
 * string.
 */
function requireNonEmptyString(value, paramName, { maxLength = MAX_INPUT_LENGTH } = {}) {
  if (typeof value !== "string") {
    throw new ApiError(400, `"${paramName}" must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ApiError(400, `"${paramName}" is required and cannot be empty.`);
  }
  if (trimmed.length > maxLength) {
    throw new ApiError(400, `"${paramName}" is too long (max ${maxLength} characters).`);
  }
  if (CONTROL_CHAR_PATTERN.test(trimmed)) {
    throw new ApiError(400, `"${paramName}" contains invalid control characters.`);
  }
  return trimmed;
}

/**
 * Validates a value is a syntactically well-formed absolute http(s) URL.
 * Doesn't verify the target actually exists/resolves — just that it's a
 * real URL — so obviously-bogus input fails fast with a specific message
 * instead of reaching the downloader (or a later `new URL()` call) and
 * failing less helpfully there.
 */
function requireHttpUrl(value, paramName) {
  const trimmed = requireNonEmptyString(value, paramName);
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ApiError(400, `"${paramName}" must be a valid absolute URL.`);
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new ApiError(400, `"${paramName}" must use http or https.`);
  }
  return trimmed;
}

/**
 * Validates input for a platform's declared queryType: a strict URL for
 * "url", free-text for "query", or either for "url_or_query" (tries URL
 * parsing first — a search term that happens to fail URL parsing is still
 * accepted as a plain query rather than being wrongly rejected).
 */
function requireInputForQueryType(value, queryType, paramName) {
  if (queryType === "url") return requireHttpUrl(value, paramName);
  if (queryType === "url_or_query") {
    const trimmed = requireNonEmptyString(value, paramName);
    try {
      new URL(trimmed);
    } catch {
      // Not a URL — that's fine, treat it as a search query instead.
    }
    return trimmed;
  }
  // "query" (free-text search)
  return requireNonEmptyString(value, paramName);
}

module.exports = { requireNonEmptyString, requireHttpUrl, requireInputForQueryType, MAX_INPUT_LENGTH };
