/**
 * Platform definitions and route mappings
 * Future me naya platform add karna ho toh bas yaha 1 entry add karni hai!
 */
const PLATFORMS = {
  instagram: {
    id: "instagram",
    name: "Instagram",
    regex: /(?:https?:\/\/)?(?:www\.|m\.)?(?:instagram\.com|instagr\.am)\/(?:p|reel|reels|tv|stories|share)\/([A-Za-z0-9_-]+)/i,
    endpoint: "/api/download/instagram",
    example: "https://www.instagram.com/reel/C8q7vP...",
  },
  threads: {
    id: "threads",
    name: "Threads",
    regex: /(?:https?:\/\/)?(?:www\.)?(?:threads\.net|threads\.com)\/(?:@[\w.-]+\/post\/|share\/|t\/)([A-Za-z0-9_-]+)/i,
    endpoint: "/api/download/threads",
    example: "https://www.threads.net/@user/post/...",
  },
  pinterest: {
    id: "pinterest",
    name: "Pinterest",
    regex: /(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)?(?:pinterest\.[a-z.]+|pin\.it)\/\S+/i,
    endpoint: "/api/download/pinterest",
    example: "https://pin.it/...",
  },
  twitch: {
    id: "twitch",
    name: "Twitch",
    regex: /(?:https?:\/\/)?(?:www\.|clips\.)?twitch\.tv\/\S+/i,
    endpoint: "/api/download/twitch",
    example: "https://www.twitch.tv/channel/clip/...",
  },
  kick: {
    id: "kick",
    name: "Kick",
    regex: /(?:https?:\/\/)?(?:www\.)?kick\.com\/\S+/i,
    endpoint: "/api/download/kick",
    example: "https://kick.com/video/...",
  },
};

/**
 * URL se platform automatically detect karta hai
 */
function detectPlatform(url) {
  if (!url || typeof url !== "string") return null;
  const clean = url.trim();

  for (const [key, platform] of Object.entries(PLATFORMS)) {
    if (platform.regex.test(clean)) {
      return key;
    }
  }

  // Fallback domain heuristics
  if (/instagram\.com|instagr\.am/i.test(clean)) return "instagram";
  if (/threads\.net|threads\.com/i.test(clean)) return "threads";
  if (/pinterest|pin\.it/i.test(clean)) return "pinterest";
  if (/twitch\.tv/i.test(clean)) return "twitch";
  if (/kick\.com/i.test(clean)) return "kick";

  return null;
}

module.exports = {
  PLATFORMS,
  detectPlatform,
  getWorkerUrl: () => process.env.PRIMARY_WORKER_URL || "https://alldownloader.solankipriyanshu94.workers.dev",
  getBackupWorkerUrl: () => process.env.BACKUP_WORKER_URL || null,
};
