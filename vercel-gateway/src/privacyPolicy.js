/**
 * Dynamic Privacy Policy Generator
 * Supports Google Play Store requirements (COPPA, GDPR, Permissions, Disclaimers)
 */

const PLATFORM_CONFIGS = {
  twitch: {
    appName: "Twitch Video & Clip Downloader",
    shortName: "Twitch Downloader",
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
  const appName = query.appName || cfg.appName;
  const developerEmail = query.email || process.env.DEVELOPER_EMAIL || "support@downloaderapp.com";
  const updatedDate = "October 2026";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Privacy Policy - ${appName}</title>
  <meta name="description" content="Privacy Policy and Terms of Use for ${appName} - compliant with Google Play Console policies." />
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
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--card-border);
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      justify-content: space-between;
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
    <div class="badge">${cfg.icon} Google Play Compliant Policy</div>
    <h1>Privacy Policy & Terms of Service</h1>
    <div class="meta">
      <span>Application: <strong>${appName}</strong></span>
      <span>Effective Date: <strong>${updatedDate}</strong></span>
    </div>

    <!-- Mandatory Third Party Disclaimer for Google Play -->
    <div class="alert-box">
      <strong>⚠️ Non-Affiliation & Copyright Disclaimer</strong>
      <p>${cfg.disclaimer}</p>
    </div>

    <h2>1. Introduction</h2>
    <p>
      Welcome to <strong>${appName}</strong> ("we," "our," or "the App"). We are committed to protecting your privacy and transparently disclosing how our application operates. 
      This Privacy Policy describes our practices concerning data collection, app permissions, and third-party interactions when you use our mobile application.
    </p>

    <h2>2. Data Collection & Privacy First Philosophy</h2>
    <p>
      <strong>We do NOT collect, store, sell, or transmit any Personally Identifiable Information (PII).</strong>
    </p>
    <ul>
      <li><strong>No Account Required:</strong> You can use all features of the App without registering, logging in, or providing personal credentials.</li>
      <li><strong>No Twitch / Third-Party Credentials Collected:</strong> We never ask for your passwords, login cookies, or account credentials.</li>
      <li><strong>No Server Logs of Personal Activity:</strong> We do not track or associate media queries with your personal identity or device IDs.</li>
    </ul>

    <h2>3. Android Permissions & Why We Need Them</h2>
    <p>
      The App requests only the bare minimum permissions necessary to perform its core functions (fetching and saving ${cfg.contentType} locally to your device storage):
    </p>
    
    <div class="permission-item">
      <code>INTERNET &amp; ACCESS_NETWORK_STATE</code>
      <p style="margin-top:6px; margin-bottom:0;">Required to connect to public media servers, fetch metadata, and download media files chosen by the user.</p>
    </div>

    <div class="permission-item">
      <code>WRITE_EXTERNAL_STORAGE / READ_MEDIA_VIDEO</code>
      <p style="margin-top:6px; margin-bottom:0;">Required on compatible Android versions solely to save downloaded video/audio files directly into your device's Gallery or Download folder.</p>
    </div>

    <div class="permission-item">
      <code>FOREGROUND_SERVICE &amp; POST_NOTIFICATIONS</code>
      <p style="margin-top:6px; margin-bottom:0;">Required to show download progress bars in your notification tray and ensure downloads complete reliably in the background.</p>
    </div>

    <h2>4. Intellectual Property & Fair Use Policy</h2>
    <p>${cfg.copyrightNotice}</p>
    <ul>
      <li>The App functions solely as a client-side utility tool to retrieve publicly accessible streams and media files.</li>
      <li>Users are solely responsible for ensuring they possess the right, license, or fair-use justification to download and store any media.</li>
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

    <h2>8. Contact Information</h2>
    <p>
      If you have questions, feedback, or copyright concerns regarding this Privacy Policy or the App, please contact our support team at:
    </p>
    <p>
      <strong>Developer Support:</strong> <a href="mailto:${developerEmail}" style="color:var(--accent); font-weight:600;">${developerEmail}</a>
    </p>

    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
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
