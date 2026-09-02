/**
 * Sets a handful of standard security-related response headers. Written by
 * hand instead of adding the `helmet` package — this project intentionally
 * keeps its dependency list small, and the specific set of headers a public
 * media-downloader API actually benefits from is short enough not to
 * justify pulling in a whole library for it.
 *
 * Deliberately does NOT set Cross-Origin-Resource-Policy — this API is
 * meant to be called cross-origin (see the permissive CORS config in
 * app.js), and CORP would work against that.
 */
function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  // Query strings on this API can carry sensitive-looking signed media
  // URLs/tokens (see /api/fetch-media) — don't leak them to third-party
  // sites via the Referer header on any outbound requests from pages we
  // serve.
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  next();
}

module.exports = securityHeaders;
