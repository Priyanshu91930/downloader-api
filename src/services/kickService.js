/**
 * Kick extractor for Videos, VODs, and Clips without FFmpeg.
 * Extracts video metadata and master HLS playlist from Kick.
 */

const { spawn } = require("child_process");

function isKickUrl(url) {
  return /(?:kick\.com)/i.test(String(url || ""));
}

function extractKickVideoId(url) {
  const u = String(url || "");
  const m = u.match(/(?:kick\.com\/[^/]+\/videos?\/|kick\.com\/video\/)([A-Za-z0-9_-]+)/i);
  return m ? m[1] : null;
}

/**
 * Extracts Kick VOD streams using lightweight yt-dlp dump-json with curl-cffi TLS impersonation.
 */
function scrapeKickWithYtDlp(url) {
  return new Promise((resolve) => {
    const pythonExe = "py";
    const args = ["-3.10", "-m", "yt_dlp", "--dump-json", "--no-warnings", "--no-playlist", url];

    const child = spawn(pythonExe, args);
    let stdoutData = "";
    let stderrData = "";

    child.stdout.on("data", (data) => {
      stdoutData += data.toString("utf8");
    });

    child.stderr.on("data", (data) => {
      stderrData += data.toString("utf8");
    });

    child.on("close", (code) => {
      if (code !== 0 || !stdoutData.trim()) {
        return resolve(null);
      }

      try {
        const info = JSON.parse(stdoutData.trim());
        const formats = Array.isArray(info.formats) ? info.formats : [];
        const media = [];

        for (const f of formats) {
          if (!f.url) continue;
          const height = f.height || (f.resolution ? parseInt(f.resolution.split("x")[1], 10) : null);
          const fps = f.fps ? Math.round(f.fps) : 30;
          const qualityLabel = f.format_id || (height ? `${height}p${fps >= 50 ? "60" : ""}` : "HD");

          media.push({
            label: `HLS Stream (${qualityLabel})`,
            quality: qualityLabel,
            type: "video",
            extension: "m3u8",
            url: f.url,
          });
        }

        if (!media.length && info.url) {
          media.push({
            label: "HLS Stream (Source)",
            quality: "Source",
            type: "video",
            extension: "m3u8",
            url: info.url,
          });
        }

        resolve({
          status: true,
          title: info.title || "Kick Video",
          thumbnail: info.thumbnail || null,
          duration: info.duration || 0,
          author: info.uploader || info.channel || null,
          result: {
            id: info.id || extractKickVideoId(url),
            title: info.title,
            thumbnail: info.thumbnail,
            duration: info.duration,
            author: info.uploader || info.channel,
            type: "video",
            media,
          },
        });
      } catch (err) {
        resolve(null);
      }
    });

    child.on("error", () => {
      resolve(null);
    });
  });
}

async function scrapeKickDirectly(url) {
  return scrapeKickWithYtDlp(url);
}

module.exports = {
  isKickUrl,
  extractKickVideoId,
  scrapeKickDirectly,
};
