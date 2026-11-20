// Lightweight safe YouTube Service for Serverless / Cloudflare
function isYouTubeUrl(input) {
  return /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/))([A-Za-z0-9_-]{11})/i.test(String(input || ""));
}

function extractYouTubeId(input) {
  const m = String(input || "").match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/))([A-Za-z0-9_-]{11})/i
  );
  return m ? m[1] : null;
}

async function scrapeYouTubeDirectly(inputUrl) {
  const videoId = extractYouTubeId(inputUrl);
  if (!videoId) return null;

  try {
    // Fast metadata extraction from YouTube Embed page without heavy Node dependencies
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return null;
    const meta = await res.json();

    const title = meta.title || "YouTube Video";
    const author = meta.author_name || "YouTube Creator";
    const thumbnail = meta.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    return {
      developer: "DIRECT_SCRAPER",
      status: true,
      title,
      thumbnail,
      author,
      result: {
        status: true,
        title,
        thumbnail,
        author,
        media: [
          {
            label: "YouTube Video (Watch / Stream)",
            type: "video",
            url: `https://www.youtube.com/watch?v=${videoId}`
          }
        ]
      },
      normalized: {
        kind: "media",
        title,
        thumbnail,
        author,
        media: [
          {
            label: "YouTube Video (Watch / Stream)",
            type: "video",
            url: `https://www.youtube.com/watch?v=${videoId}`
          }
        ]
      }
    };
  } catch (err) {
    return null;
  }
}

module.exports = {
  isYouTubeUrl,
  extractYouTubeId,
  scrapeYouTubeDirectly,
};
