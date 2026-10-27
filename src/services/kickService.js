/**
 * Pure JavaScript Kick Extractor (Zero Python / Zero FFmpeg / 100% Vercel Ready)
 * Uses Kick's official mobile client endpoints to bypass Cloudflare bot challenges
 * and directly extract VOD / stream master playlists with all resolutions.
 */

const KICK_MOBILE_UA = "okhttp/4.9.2 KickAndroid/1.0.0";

function isKickUrl(url) {
  return /(?:kick\.com)/i.test(String(url || ""));
}

function extractKickVideoId(url) {
  const u = String(url || "");
  const m = u.match(/(?:kick\.com\/[^/]+\/videos?\/|kick\.com\/video\/)([A-Za-z0-9_-]+)/i);
  return m ? m[1] : null;
}

function extractKickClipSlug(url) {
  const u = String(url || "");
  const m = u.match(/kick\.com\/[^/]+[?&]clip=([A-Za-z0-9_-]+)|kick\.com\/clips?\/([A-Za-z0-9_-]+)/i);
  return m ? (m[1] || m[2]) : null;
}

async function scrapeKickPureJs(url) {
  const videoId = extractKickVideoId(url);
  if (!videoId) {
    return null;
  }

  const playbackEndpoint = `https://web.kick.com/api/v1/stream/${videoId}/playback`;

  const pbRes = await fetch(playbackEndpoint, {
    method: "POST",
    headers: {
      "User-Agent": KICK_MOBILE_UA,
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      video_player: { player: {} },
      video_session: {},
      user_session: { non_personalised_ads: true },
    }),
  });

  if (!pbRes.ok) {
    return null;
  }

  const pbData = await pbRes.json();
  const vSession = pbData.video_session || {};
  const playbackUrl = pbData.playback_url || {};
  const manifestUrl = playbackUrl.vod || playbackUrl.live || "";

  if (!manifestUrl) {
    return null;
  }

  const title = vSession.video_title || "Kick Video";
  const author = vSession.video_series || null;
  const duration = vSession.video_duration || 0;
  const thumbnail = playbackUrl.thumbnail || null;

  const media = [];

  try {
    const maniRes = await fetch(manifestUrl, {
      headers: {
        "User-Agent": KICK_MOBILE_UA,
      },
    });

    if (maniRes.ok) {
      const manifestText = await maniRes.text();
      const lines = manifestText.split("\n");
      let currentQuality = "HD";

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith("#EXT-X-STREAM-INF:")) {
          const groupMatch = line.match(/VIDEO="([^"]+)"/);
          const resMatch = line.match(/RESOLUTION=\d+x(\d+)/);
          if (groupMatch) {
            currentQuality = groupMatch[1];
          } else if (resMatch) {
            currentQuality = `${resMatch[1]}p`;
          }
        } else if (line.startsWith("http://") || line.startsWith("https://")) {
          media.push({
            label: `HLS Stream (${currentQuality})`,
            quality: currentQuality,
            type: "video",
            extension: "m3u8",
            url: line,
          });
        }
      }
    }
  } catch (_) {}

  if (!media.length) {
    media.push({
      label: "Master HLS Playlist",
      quality: "Auto",
      type: "video",
      extension: "m3u8",
      url: manifestUrl,
    });
  }

  return {
    status: true,
    title,
    thumbnail,
    duration,
    author,
    result: {
      id: videoId,
      title,
      thumbnail,
      duration,
      author,
      type: "video",
      media,
    },
  };
}

async function scrapeKickDirectly(url) {
  return scrapeKickPureJs(url);
}

module.exports = {
  isKickUrl,
  extractKickVideoId,
  scrapeKickDirectly,
};
