/**
 * Dynamic Privacy Policy Generator
 * Supports Google Play Store requirements (COPPA, GDPR, Permissions, Disclaimers)
 */

const PLATFORM_CONFIGS = {
  twitch: {
    appName: "Twitch Video & Clip Downloader",
    shortName: "Twitch Downloader",
    packageName: "com.twitchvideodownloader.app",
    developerName: "Swadeshi App Studio",
    platformName: "Twitch",
    officialDomain: "twitch.tv",
    contentType: "clips, livestreams, and VODs",
    themeColor: "#9146FF",
    icon: "🟣",
    disclaimer: "This application is an independent third-party tool and is NOT affiliated with, sponsored, authorized, or endorsed by Twitch Interactive, Inc. or Amazon.com, Inc. All trademarks, service marks, and company names are the property of their respective owners.",
    copyrightNotice: "Users are strictly advised to respect content creators' intellectual property. Only download public clips and videos for personal, offline, non-commercial use with permission from the respective content creators.",
  },
  kick: {
    appName: "Kick Video Downloader",
    shortName: "Kick Downloader",
    platformName: "Kick",
    officialDomain: "kick.com",
    contentType: "clips, streams, and VODs",
    themeColor: "#53FC18",
    icon: "🟢",
    disclaimer: "This application is an independent utility and is NOT affiliated with, sponsored, or endorsed by Kick Gaming / Kick.com. All trademarks and registered trademarks are the property of their respective owners.",
    copyrightNotice: "Please obtain proper authorization before downloading or distributing content. Downloaded media must strictly be used for personal, offline viewing.",
  },
  instagram: {
    appName: "Video Downloader for Instagram",
    shortName: "Insta Downloader",
    platformName: "Instagram",
    officialDomain: "instagram.com",
    contentType: "reels, photos, and stories",
    themeColor: "#E1306C",
    icon: "📸",
    disclaimer: "This application is NOT affiliated with, associated with, or endorsed by Instagram, Meta Platforms, Inc. All trademarks belong to Meta Platforms, Inc.",
    copyrightNotice: "Please respect intellectual property rights. Do not repost or monetize content downloaded using this app without express permission from the copyright owner.",
  },
  threads: {
    appName: "Video Downloader for Threads",
    shortName: "Threads Downloader",
    platformName: "Threads",
    officialDomain: "threads.net",
    contentType: "videos, photos, and posts",
    themeColor: "#000000",
    icon: "🧵",
    disclaimer: "This application is an independent tool and is NOT affiliated with, endorsed by, or sponsored by Threads or Meta Platforms, Inc.",
    copyrightNotice: "Downloaded media must be for personal, offline use only.",
  },
  pinterest: {
    appName: "Video Downloader for Pinterest",
    shortName: "Pin Downloader",
    platformName: "Pinterest",
    officialDomain: "pinterest.com",
    contentType: "pins, ideas, and video clips",
    themeColor: "#BD081C",
    icon: "📌",
    disclaimer: "This application is NOT affiliated with, associated with, or endorsed by Pinterest, Inc. All Pinterest logos and trademarks are the property of Pinterest, Inc.",
    copyrightNotice: "Respect creators' copyrights. Content downloaded through this app must be used in accordance with fair use and copyright laws.",
  },
  default: {
    appName: "Universal Video Downloader",
    shortName: "Video Downloader",
    platformName: "Social Media",
    officialDomain: "the respective platform",
    contentType: "public media and videos",
    themeColor: "#6366F1",
    icon: "⚡",
    disclaimer: "This application is an independent utility and is NOT affiliated with, sponsored, or endorsed by any third-party social media platform or company.",
    copyrightNotice: "Users are responsible for ensuring they have the right to access and download media. Always respect copyrights and intellectual property rights.",
  },
};

function getPlatformConfig(slug) {
  if (!slug) return PLATFORM_CONFIGS.default;
  const key = slug.toLowerCase().replace(/[^a-z0-9]/g, "");
  return PLATFORM_CONFIGS[key] || {
    ...PLATFORM_CONFIGS.default,
    appName: `${slug.charAt(0).toUpperCase() + slug.slice(1)} Downloader`,
    shortName: `${slug.charAt(0).toUpperCase() + slug.slice(1)} Downloader`,
    platformName: slug.charAt(0).toUpperCase() + slug.slice(1),
  };
}

function renderPrivacyPolicyHtml(slug, query = {}) {
  const cfg = getPlatformConfig(slug);
  const appName = query.appName || query.app || cfg.appName;
  const developerName = query.dev || query.developer || query.entity || cfg.developerName || process.env.DEVELOPER_NAME || "Swadeshi App Studio";
  const packageName = query.pkg || query.package || query.appId || cfg.packageName || process.env.PACKAGE_NAME || "com.twitchvideodownloader.app";
  const developerEmail = query.email || query.contact || process.env.DEVELOPER_EMAIL || "solankipriyanshu94@gmail.com";
  const updatedDate = "November 2026";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Privacy Policy - ${appName} (${developerName})</title>
  <meta name="description" content="Privacy Policy and Terms of Use for ${appName} by ${developerName} - fully compliant with Google Play Console Developer Policies." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #0b0f19;
      --card: #111827;
      --card-border: #1f2937;
      --accent: ${cfg.themeColor};
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
      --warning-bg: rgba(245, 158, 11, 0.08);
      --warning-border: #f59e0b;
      --id-bg: rgba(255, 255, 255, 0.03);
      --id-border: rgba(255, 255, 255, 0.08);
      --font-main: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
      --font-mono: "JetBrains Mono", monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text-main);
      font-family: var(--font-main);
      line-height: 1.7;
      padding: 32px 16px 80px;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 820px;
      margin: 0 auto;
      background: var(--card);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: clamp(24px, 5vw, 48px);
      box-shadow: 0 20px 40px -15px rgba(0,0,0,0.5);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--card-border);
      color: var(--text-muted);
      font-size: 0.82rem;
      font-weight: 600;
      padding: 6px 14px;
      border-radius: 9999px;
      margin-bottom: 20px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    h1 {
      font-size: clamp(1.8rem, 4vw, 2.4rem);
      font-weight: 800;
      color: #ffffff;
      line-height: 1.25;
      margin-bottom: 8px;
    }
    .meta {
      color: var(--text-muted);
      font-size: 0.9rem;
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--card-border);
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      justify-content: space-between;
    }
    .id-card {
      background: var(--id-bg);
      border: 1px solid var(--id-border);
      border-radius: 14px;
      padding: 20px;
      margin-bottom: 28px;
    }
    .id-card-title {
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--accent);
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .id-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 12px 20px;
      font-size: 0.92rem;
    }
    .id-row {
      display: flex;
      flex-direction: column;
    }
    .id-label {
      color: var(--text-muted);
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .id-value {
      color: #ffffff;
      font-weight: 600;
      word-break: break-all;
    }
    .id-value code {
      font-family: var(--font-mono);
      color: var(--accent);
      font-size: 0.88rem;
    }
    .alert-box {
      background: var(--warning-bg);
      border-left: 4px solid var(--warning-border);
      padding: 16px 20px;
      border-radius: 0 12px 12px 0;
      margin: 28px 0;
    }
    .alert-box strong {
      color: #fbbf24;
      display: block;
      margin-bottom: 6px;
      font-size: 0.95rem;
    }
    .alert-box p {
      color: #d1d5db;
      font-size: 0.9rem;
      line-height: 1.6;
    }
    h2 {
      font-size: 1.3rem;
      font-weight: 700;
      color: #ffffff;
      margin-top: 36px;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    h2::before {
      content: "";
      display: inline-block;
      width: 4px;
      height: 18px;
      background: var(--accent);
      border-radius: 2px;
    }
    p, li {
      color: #d1d5db;
      font-size: 0.96rem;
      margin-bottom: 14px;
    }
    ul {
      padding-left: 24px;
      margin-bottom: 20px;
    }
    li {
      margin-bottom: 8px;
    }
    .permission-item {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      padding: 14px 18px;
      margin-bottom: 10px;
    }
    .permission-item code {
      font-family: var(--font-mono);
      color: var(--accent);
      font-weight: 600;
      font-size: 0.88rem;
    }
    .footer {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 1px solid var(--card-border);
      text-align: center;
      color: var(--text-muted);
      font-size: 0.85rem;
    }
    .footer a {
      color: var(--accent);
      text-decoration: none;
    }
    .footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">${cfg.icon} Google Play Developer Policy Compliant</div>
    <h1>Privacy Policy & Terms of Service</h1>
    <div class="meta">
      <span>Application: <strong>${appName}</strong></span>
      <span>Effective Date: <strong>${updatedDate}</strong></span>
    </div>

    <!-- Explicit Google Play Developer & App Identifier Section -->
    <div class="id-card">
      <div class="id-card-title">📋 Google Play Store Listing &amp; Developer Details</div>
      <div class="id-grid">
        <div class="id-row">
          <span class="id-label">Application Title</span>
          <span class="id-value">${appName}</span>
        </div>
        ${packageName ? `
        <div class="id-row">
          <span class="id-label">Package Name (Application ID)</span>
          <span class="id-value"><code>${packageName}</code></span>
        </div>` : ""}
        <div class="id-row">
          <span class="id-label">Developer / Publisher Name</span>
          <span class="id-value">${developerName}</span>
        </div>
        <div class="id-row">
          <span class="id-label">Developer Contact Email</span>
          <span class="id-value"><a href="mailto:${developerEmail}" style="color:var(--accent); text-decoration:none;">${developerEmail}</a></span>
        </div>
      </div>
    </div>

    <!-- Mandatory Third Party Disclaimer for Google Play -->
    <div class="alert-box">
      <strong>⚠️ Non-Affiliation & Copyright Disclaimer</strong>
      <p>${cfg.disclaimer}</p>
    </div>

    <h2>1. Introduction & Publisher Identification</h2>
    <p>
      This Privacy Policy governs the mobile application <strong>${appName}</strong>${packageName ? ` (Package Name: <code>${packageName}</code>)` : ""}, which is developed, published, and maintained by <strong>${developerName}</strong> ("Developer", "we", "our", or "us") on the Google Play Store.
    </p>
    <p>
      We are dedicated to safeguarding your privacy and ensuring transparency regarding our app's operations. This policy explicitly describes how our application operates, our zero-data collection architecture, device permissions, and our adherence to Google Play Developer Program Policies.
    </p>

    <h2>2. Data Collection & Privacy First Philosophy</h2>
    <p>
      <strong>We do NOT collect, store, sell, monetize, or transmit any Personally Identifiable Information (PII) or user data.</strong>
    </p>
    <ul>
      <li><strong>No Account Required:</strong> You can use all features of the App without registering, logging in, or providing any personal details.</li>
      <li><strong>No Credentials or Cookies:</strong> We never request, read, or store passwords, tokens, cookies, or account credentials.</li>
      <li><strong>No Tracking or Profiling:</strong> We do not track user activity, associate media downloads with device IDs, or build behavioral profiles.</li>
      <li><strong>No Server-Side Media Retention:</strong> Downloaded media is transferred directly to your local device storage and is never retained on our servers.</li>
    </ul>

    <h2>3. Android Permissions & Why We Need Them</h2>
    <p>
      The App requests only the minimum runtime permissions strictly required to provide its core utility functions (saving ${cfg.contentType} locally to your device storage):
    </p>
    
    <div class="permission-item">
      <code>INTERNET &amp; ACCESS_NETWORK_STATE</code>
      <p style="margin-top:6px; margin-bottom:0;">Required to access public media servers, fetch metadata, and download media files initiated directly by you.</p>
    </div>

    <div class="permission-item">
      <code>WRITE_EXTERNAL_STORAGE / READ_MEDIA_VIDEO</code>
      <p style="margin-top:6px; margin-bottom:0;">Required on compatible Android operating systems solely to save downloaded video/audio files directly into your device's Downloads or Gallery directory.</p>
    </div>

    <div class="permission-item">
      <code>FOREGROUND_SERVICE &amp; POST_NOTIFICATIONS</code>
      <p style="margin-top:6px; margin-bottom:0;">Required on Android 13+ to display ongoing download progress in your system notification tray and ensure downloads complete reliably in the background.</p>
    </div>

    <h2>4. Intellectual Property & Fair Use Policy</h2>
    <p>${cfg.copyrightNotice}</p>
    <ul>
      <li>The App functions solely as a client-side tool to retrieve publicly accessible streams and media files.</li>
      <li>Users are solely responsible for ensuring they possess the right, license, or fair-use authorization to download and store any content.</li>
      <li>We strictly discourage and do not condone the unauthorized downloading, distribution, or re-uploading of copyrighted materials.</li>
    </ul>

    <h2>5. Third-Party Services & Advertisements</h2>
    <p>
      To support the ongoing maintenance and development of this free application, the App may integrate vetted third-party SDKs (such as Google AdMob). These third-party providers may collect anonymized diagnostics:
    </p>
    <ul>
      <li>Google Mobile Ads (AdMob) - <a href="https://policies.google.com/privacy" target="_blank" rel="noopener" style="color:var(--accent);">Google Privacy Policy</a></li>
      <li>Firebase Crashlytics / Google Play Services (Crash reporting &amp; stability analytics)</li>
    </ul>

    <h2>6. Children's Online Privacy Protection (COPPA)</h2>
    <p>
      Our application is NOT directed to children under the age of 13. We do not knowingly collect or solicit personal information from children under 13. If you believe that a child under 13 has provided us with personal information, please contact us immediately so we can remove it.
    </p>

    <h2>7. Changes to This Privacy Policy</h2>
    <p>
      We may periodically update this Privacy Policy to comply with Google Play Policy updates and legal requirements. Any modifications will take effect immediately upon updating this page.
    </p>

    <h2>8. Developer &amp; Legal Entity Contact Information</h2>
    <p>
      If you have questions, feedback, or inquiries regarding this Privacy Policy, your rights, or the application, please reach out directly:
    </p>
    <p style="margin-bottom: 6px;">
      <strong>Developer / Publisher:</strong> ${developerName}
    </p>
    <p style="margin-bottom: 6px;">
      <strong>Application Title:</strong> ${appName}
    </p>
    ${packageName ? `<p style="margin-bottom: 6px;"><strong>Package Name:</strong> <code>${packageName}</code></p>` : ""}
    <p>
      <strong>Developer Contact Email:</strong> <a href="mailto:${developerEmail}" style="color:var(--accent); font-weight:600;">${developerEmail}</a>
    </p>

    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${developerName}. All rights reserved.</p>
      <p style="margin-top: 6px;">Compliant with Google Play Developer Program Policies</p>
    </div>
  </div>
</body>
</html>`;
}

module.exports = {
  PLATFORM_CONFIGS,
  getPlatformConfig,
  renderPrivacyPolicyHtml,
};
