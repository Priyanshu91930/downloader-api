require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { PLATFORMS, detectPlatform, getWorkerUrl, getBackupWorkerUrl } = require("./config");
const { renderPrivacyPolicyHtml, PLATFORM_CONFIGS } = require("./privacyPolicy");

const app = express();

// Trust proxy for Vercel / serverless deployments
app.set("trust proxy", true);
app.disable("x-powered-by");

// Global Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

// 0. Privacy Policy Routes (Google Play Store Compliant)
// Matches /twitch, /kick, /instagram, /threads, /pinterest, or /privacy/:platform, /privacy-policy/:platform
const KNOWN_PLATFORM_SLUGS = ["twitch", "kick", "instagram", "threads", "pinterest", "privacy", "policy"];

app.get(
  [
    "/privacy",
    "/privacy-policy",
    "/privacy/:platform",
    "/privacy-policy/:platform",
    "/:platform(twitch|kick|instagram|threads|pinterest)",
  ],
  (req, res) => {
    const slug = req.params.platform || req.query.platform || "twitch";
    const html = renderPrivacyPolicyHtml(slug, req.query);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
    return res.send(html);
  }
);

// 1. Root tester info
app.get("/", (req, res) => {
  res.json({
    name: "Downloader API Gateway",
    version: "1.0.0",
    status: "active",
    endpoints: {
      universal_download: "/api/download?url=YOUR_URL",
      explicit_download: "/api/download/:platform?url=YOUR_URL",
      remote_config: "/api/config",
      health: "/api/health",
      privacy_policies: {
        twitch: "/twitch or /privacy/twitch",
        kick: "/kick or /privacy/kick",
        instagram: "/instagram or /privacy/instagram",
        threads: "/threads or /privacy/threads",
        pinterest: "/pinterest or /privacy/pinterest",
      },
    },
    supported_platforms: Object.keys(PLATFORMS),
  });
});

// 2. Health check endpoint
app.get(["/health", "/api/health"], (req, res) => {
  res.json({
    success: true,
    status: "ok",
    timestamp: new Date().toISOString(),
    worker: getWorkerUrl(),
  });
});

// 3. Remote Config Endpoint (For Android App to fetch dynamically)
app.get(["/api/config", "/api/platforms"], (req, res) => {
  const platforms = Object.values(PLATFORMS).map((p) => ({
    id: p.id,
    name: p.name,
    example: p.example,
    endpoint: p.endpoint,
  }));

  res.json({
    success: true,
    worker_url: getWorkerUrl(),
    platforms,
    total: platforms.length,
  });
});

/**
 * Helper to fetch from Cloudflare Worker with timeout
 */
async function fetchFromWorker(targetUrl, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Vercel-Downloader-Gateway/1.0",
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      return { status: response.status, data };
    }

    const text = await response.text();
    return {
      status: response.status,
      data: { success: false, error: { message: text || "Invalid response from upstream worker" } },
    };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      throw new Error("Cloudflare worker request timed out.");
    }
    throw err;
  }
}

/**
 * Main Downloader Handler
 * Handles both:
 * 1) /api/download?url=... (Smart auto-detect)
 * 2) /api/download/:platform?url=... (Explicit platform)
 */
async function handleDownload(req, res) {
  try {
    let rawUrl = req.query.url || req.query.query;

    // Handle malformed query strings (e.g. unencoded &)
    if (!rawUrl && req.url.includes("url=")) {
      rawUrl = req.url.split("url=")[1];
    }

    if (!rawUrl) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Missing "url" query parameter. Example: /api/download?url=https://www.instagram.com/reel/...',
          statusCode: 400,
        },
      });
    }

    let inputUrl = decodeURIComponent(rawUrl.trim());
    inputUrl = inputUrl.split("&")[0]; // Remove trailing app params

    // 1. Determine platform (from URL param or auto-detection)
    let requestedPlatform = req.params.platform?.toLowerCase();
    if (!requestedPlatform || requestedPlatform === "aio" || requestedPlatform === "auto") {
      requestedPlatform = detectPlatform(inputUrl);
    }

    if (!requestedPlatform) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Unsupported platform or invalid link format. Supported platforms: " + Object.keys(PLATFORMS).join(", "),
          statusCode: 400,
        },
      });
    }

    const platformConfig = PLATFORMS[requestedPlatform];
    const endpointPath = platformConfig ? platformConfig.endpoint : `/api/download/${requestedPlatform}`;

    // 2. Build target worker URL
    const primaryWorker = getWorkerUrl().replace(/\/+$/, "");
    const targetUrl = `${primaryWorker}${endpointPath}?url=${encodeURIComponent(inputUrl)}`;

    // 3. Forward to Cloudflare Worker
    try {
      const workerResponse = await fetchFromWorker(targetUrl);
      return res.status(workerResponse.status).json(workerResponse.data);
    } catch (primaryErr) {
      // 4. Fallback to backup worker if configured
      const backupWorker = getBackupWorkerUrl();
      if (backupWorker) {
        try {
          const backupTarget = `${backupWorker.replace(/\/+$/, "")}${endpointPath}?url=${encodeURIComponent(inputUrl)}`;
          const backupResponse = await fetchFromWorker(backupTarget);
          return res.status(backupResponse.status).json(backupResponse.data);
        } catch (_) {}
      }

      return res.status(502).json({
        success: false,
        error: {
          message: primaryErr.message || "Failed to reach downloader worker.",
          statusCode: 502,
        },
      });
    }
  } catch (globalErr) {
    return res.status(500).json({
      success: false,
      error: {
        message: globalErr.message || "Internal Gateway Error",
        statusCode: 500,
      },
    });
  }
}

// 4. Download Endpoints
// Smart Universal Route (Auto-detects platform)
app.get("/api/download", handleDownload);

// Explicit Platform Route (Backward compatibility)
app.get("/api/download/:platform", handleDownload);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Route not found: ${req.method} ${req.url}`,
      statusCode: 404,
    },
  });
});

module.exports = app;
