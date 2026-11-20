let ytdlModule = null;
async function getYtdl() {
  if (!ytdlModule) {
    ytdlModule = await import("@distube/ytdl-core");
  }
  return ytdlModule;
}

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
  try {
    const videoId = extractYouTubeId(inputUrl);
    if (!videoId) return null;
    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;

    const { Ytdl, Client } = await getYtdl();
    const yt = new Ytdl({
      clients: [Client.Tv, Client.WebEmbedded, Client.Mweb, Client.VisionOS]
    });

    const info = await yt.getInfo(canonicalUrl);
    if (!info || !info.videoDetails) return null;

    const title = info.videoDetails.title || "YouTube Video";
    const author = info.videoDetails.author?.name || "YouTube Creator";
    const thumbnails = info.videoDetails.thumbnails || [];
    const thumbnail = thumbnails.length ? thumbnails[thumbnails.length - 1].url : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    const media = [];
    const seenUrls = new Set();
    const seenQualities = new Set();

    const videoFormats = (info.formats || [])
      .filter(f => f.hasVideo && f.url)
      .sort((a, b) => (b.height || 0) - (a.height || 0));

    for (const f of videoFormats) {
      const height = f.height || (f.qualityLabel ? parseInt(f.qualityLabel, 10) : 0);
      const container = f.container || (f.mimeType && f.mimeType.includes("mp4") ? "mp4" : "webm");

      const qualityTag = height >= 2160 ? "4K (2160p)" :
                         height >= 1440 ? "2K (1440p)" :
                         height >= 1080 ? "1080p FHD" :
                         height >= 720  ? "720p HD" :
                         height >= 480  ? "480p" :
                         height >= 360  ? "360p" :
                         height ? `${height}p` : (f.qualityLabel || "Video");

      const key = `${qualityTag}-${container}`;
      if (!seenQualities.has(key) && !seenUrls.has(f.url)) {
        seenQualities.add(key);
        seenUrls.add(f.url);
        media.push({
          label: `${container.toUpperCase()} Video (${qualityTag})`,
          type: "video",
          url: f.url,
          resolution: height ? `${height}p` : undefined,
          itag: f.itag
        });
      }
    }

    const audioFormats = (info.formats || [])
      .filter(f => !f.hasVideo && f.hasAudio && f.url)
      .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));

    for (const f of audioFormats) {
      if (!seenUrls.has(f.url)) {
        seenUrls.add(f.url);
        const bitrate = f.audioBitrate ? `${f.audioBitrate} kbps` : "High Quality";
        const formatExt = (f.container || (f.mimeType && f.mimeType.includes("mp4") ? "m4a" : "mp3")).toUpperCase();
        media.push({
          label: `${formatExt} Audio (${bitrate})`,
          type: "audio",
          url: f.url,
          bitrate: f.audioBitrate,
          itag: f.itag
        });
        if (media.filter(m => m.type === "audio").length >= 2) break;
      }
    }

    if (!media.length) return null;

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
        mp4: media.find(m => m.type === "video")?.url || null,
        mp3: media.find(m => m.type === "audio")?.url || null,
        media,
      },
      normalized: {
        kind: "media",
        title,
        thumbnail,
        author,
        media,
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
