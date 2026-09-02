require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const downloaderRoutes = require("./routes/downloader");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const requestLogger = require("./middleware/requestLogger");
const requestTimeout = require("./middleware/requestTimeout");
const securityHeaders = require("./middleware/securityHeaders");

const app = express();
app.disable("x-powered-by");

// --- Core middleware ---
app.use(requestLogger);
app.use(requestTimeout());
app.use(securityHeaders);
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

// --- Rate limiting (protects the wrapped downloader endpoints from abuse) ---
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  max: Number(process.env.RATE_LIMIT_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: "Too many requests, please try again shortly.", statusCode: 429 } },
});
app.use("/api", limiter);

// --- Static frontend (simple endpoint tester) ---
// Short maxAge so active development picks up changes reasonably fast,
// while repeat visits within that window skip a full re-fetch. etag stays
// on (express.static default) so a change is still picked up immediately
// even within the cache window via a 304 revalidation.
app.use(
  express.static(path.join(__dirname, "..", "public"), {
    maxAge: "1h",
    etag: true,
  })
);

// --- Health check ---
app.get("/api/health", (req, res) => {
  res.json({ success: true, status: "ok", uptime: process.uptime() });
});

// --- API routes ---
app.use("/api", downloaderRoutes);

// --- 404 + error handling (must be last) ---
app.use(notFound);
app.use(errorHandler);

module.exports = app;
