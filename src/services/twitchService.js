/**
 * Twitch extractor for Clips and VODs without FFmpeg.
 * Directly calls Twitch GQL and Usher endpoints to get direct MP4 and HLS streams.
 */

const TWITCH_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";

function isTwitchUrl(url) {
  return /(?:twitch\.tv|clips\.twitch\.tv)/i.test(String(url || ""));
}

function extractClipSlug(url) {
  const u = String(url || "");
  const clipMatch = u.match(/(?:clips\.twitch\.tv\/|twitch\.tv\/[^/]+\/clip\/)([A-Za-z0-9_-]+)/i);
  return clipMatch ? clipMatch[1] : null;
}

function extractVodId(url) {
  const u = String(url || "");
  const vodMatch = u.match(/twitch\.tv\/videos\/(\d+)/i);
  return vodMatch ? vodMatch[1] : null;
}

async function fetchTwitchGQL(query, variables) {
  const res = await fetch("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: {
      "Client-ID": TWITCH_CLIENT_ID,
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`Twitch GQL responded with status ${res.status}`);
  }
  return res.json();
}

async function scrapeTwitchClip(slug) {
  const query = `
    query($slug: ID!) {
      clip(slug: $slug) {
        id
        title
        durationSeconds
        thumbnailURL
        broadcaster { displayName }
        videoQualities { quality frameRate sourceURL }
        playbackAccessToken(params: {platform: "web", playerType: "site"}) { signature value }
      }
    }
  `;

  const gqlRes = await fetchTwitchGQL(query, { slug });
  const clip = gqlRes && gqlRes.data && gqlRes.data.clip;
  if (!clip) return null;

  const sig = clip.playbackAccessToken?.signature || "";
  const token = encodeURIComponent(clip.playbackAccessToken?.value || "");
  const tokenSuffix = sig && token ? `?sig=${sig}&token=${token}` : "";

  const media = [];
  const qualities = Array.isArray(clip.videoQualities) ? clip.videoQualities : [];
  for (const q of qualities) {
    if (!q.sourceURL) continue;
    const directUrl = `${q.sourceURL}${tokenSuffix}`;
    const label = q.quality ? `${q.quality}p${q.frameRate >= 50 ? "60" : ""}` : "MP4 Video";
    media.push({
      label,
      quality: q.quality ? `${q.quality}p` : "HD",
      type: "video",
      extension: "mp4",
      url: directUrl,
    });
  }

  return {
    status: true,
    title: clip.title || "Twitch Clip",
    thumbnail: clip.thumbnailURL || null,
    duration: clip.durationSeconds || 0,
    author: clip.broadcaster?.displayName || null,
    result: {
      id: clip.id,
      title: clip.title,
      thumbnail: clip.thumbnailURL,
      duration: clip.durationSeconds,
      author: clip.broadcaster?.displayName,
      type: "clip",
      media,
    },
  };
}

async function scrapeTwitchVod(vodId) {
  const query = `
    query($id: ID!) {
      video(id: $id) {
        id
        title
        lengthSeconds
        previewThumbnailURL(height: 720, width: 1280)
        owner { displayName }
        playbackAccessToken(params: {platform: "web", playerBackend: "mediaplayer", playerType: "site"}) {
          signature
          value
        }
      }
    }
  `;

  const gqlRes = await fetchTwitchGQL(query, { id: vodId });
  const video = gqlRes && gqlRes.data && gqlRes.data.video;
  if (!video || !video.playbackAccessToken) return null;

  const sig = video.playbackAccessToken.signature;
  const token = encodeURIComponent(video.playbackAccessToken.value);
  const masterPlaylistUrl = `https://usher.ttvnw.net/vod/${vodId}.m3u8?sig=${sig}&token=${token}&allow_source=true&allow_audio_only=true`;

  const media = [];
  try {
    const usherRes = await fetch(masterPlaylistUrl);
    if (usherRes.ok) {
      const playlistText = await usherRes.text();
      const lines = playlistText.split("\n");
      let currentQuality = "Source";
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith("#EXT-X-STREAM-INF:")) {
          const resMatch = line.match(/RESOLUTION=\d+x(\d+)/);
          const videoGroupMatch = line.match(/VIDEO="([^"]+)"/);
          if (videoGroupMatch) {
            currentQuality = videoGroupMatch[1];
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
      url: masterPlaylistUrl,
    });
  }

  return {
    status: true,
    title: video.title || "Twitch VOD",
    thumbnail: video.previewThumbnailURL || null,
    duration: video.lengthSeconds || 0,
    author: video.owner?.displayName || null,
    result: {
      id: video.id,
      title: video.title,
      thumbnail: video.previewThumbnailURL,
      duration: video.lengthSeconds,
      author: video.owner?.displayName,
      type: "vod",
      media,
    },
  };
}

async function scrapeTwitchDirectly(url) {
  const clipSlug = extractClipSlug(url);
  if (clipSlug) {
    return scrapeTwitchClip(clipSlug);
  }
  const vodId = extractVodId(url);
  if (vodId) {
    return scrapeTwitchVod(vodId);
  }
  return null;
}

module.exports = {
  isTwitchUrl,
  extractClipSlug,
  extractVodId,
  scrapeTwitchDirectly,
};
