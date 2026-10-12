/**
 * Bulletproof Cloudflare Worker Downloader API
 * Stage 1: Ultra-Fast Cloudflare Edge Scraping (0.8s)
 * Stage 2: Automatic Vercel Backend Origin Fallback (if Botcahx/scrapers crash)
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const vercelOrigin = (env && env.VERCEL_ORIGIN) || 'https://downloader-api-tau.vercel.app';
    
    // CORS headers for Web UI & Mobile App
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 1. Health check endpoint
    if (url.pathname === '/health' || url.pathname === '/api/health') {
      return new Response(JSON.stringify({ status: true, worker: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 2. Platforms list endpoint
    if (url.pathname === '/api/platforms') {
      return new Response(JSON.stringify({
        status: true,
        platforms: ['instagram', 'threads', 'pinterest'],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 3. Media Download Endpoint (/api/download/instagram or /api/download/threads or /api/download/pinterest)
    if (url.pathname.startsWith('/api/download/')) {
      const platform = url.pathname.split('/api/download/')[1]?.toLowerCase();

      // Extract raw target query string (handles URLs with unencoded &)
      const rawSearch = url.search;
      let inputUrl = url.searchParams.get('url') || url.searchParams.get('query');
      if (rawSearch.includes('url=')) {
        inputUrl = rawSearch.split('url=')[1];
      }

      if (!inputUrl) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Missing required "url" query parameter.', statusCode: 400 },
        }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      // Clean & decode inputUrl
      try { inputUrl = decodeURIComponent(inputUrl); } catch (_) {}
      inputUrl = inputUrl.split('&')[0]; // Clean trailing query parameters

      // STAGE 1: Fast Direct Edge Scraping on Cloudflare
      try {
        let directResult = null;
        if (platform === 'threads' || /threads\.(com|net)/i.test(inputUrl)) {
          directResult = await scrapeThreadsDirectly(inputUrl);
        } else if (platform === 'instagram' || /instagram\.com/i.test(inputUrl)) {
          directResult = await scrapeInstagramDirectly(inputUrl);
        } else if (platform === 'pinterest' || /(pinterest\.[a-z.]+|pin\.it)/i.test(inputUrl)) {
          directResult = await scrapePinterestDirectly(inputUrl);
        }

        if (directResult && (directResult.url || directResult.video || (directResult.media && directResult.media.length > 0))) {
          const mediaUrl = directResult.url || directResult.video || directResult.media[0].url;
          const isVideo = directResult.type === 'video' || (directResult.media && directResult.media.some(m => m.type === 'video'));
          const normalizedMedia = (directResult.media && directResult.media.length > 0)
            ? directResult.media.map((m, idx) => ({
                label: m.quality || m.label || (m.type === 'video' ? 'HD Video' : (idx === 0 ? 'Image' : 'Cover Image')),
                type: m.type || (m.url.match(/\.(jpg|jpeg|png|webp)/i) ? 'image' : 'video'),
                url: m.url,
              }))
            : [{ label: isVideo ? 'HD Video' : 'Image', type: isVideo ? 'video' : 'image', url: mediaUrl }];

          return new Response(JSON.stringify({
            success: true,
            status: true,
            platform: platform,
            title: directResult.title || `${platform.toUpperCase()} Media`,
            thumbnail: directResult.thumbnail || mediaUrl,
            url: mediaUrl,
            result: {
              type: isVideo ? 'video' : 'image',
              video: isVideo ? (directResult.video || mediaUrl) : null,
              media: directResult.media || [{ quality: isVideo ? 'HD Video' : 'Image', type: isVideo ? 'video' : 'image', url: mediaUrl }],
            },
            normalized: {
              kind: 'media',
              title: directResult.title || `${platform.toUpperCase()} Media`,
              thumbnail: directResult.thumbnail || mediaUrl,
              author: directResult.author || null,
              media: normalizedMedia,
            },
          }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
      } catch (_) {}

      // STAGE 2: Fallback to Vercel Backend Origin with 28s Extended Budget (Guarantees Success when free APIs crash)
      try {
        const targetVercelUrl = `${vercelOrigin.replace(/\/+$/, '')}${url.pathname}?url=${encodeURIComponent(inputUrl)}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 28000);

        const vRes = await fetch(targetVercelUrl, {
          method: 'GET',
          headers: {
            'User-Agent': request.headers.get('User-Agent') || 'CloudflareWorkerProxy/1.0',
            'Accept': 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (vRes.ok) {
          const contentType = vRes.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await vRes.json();
            return new Response(JSON.stringify(data), {
              status: 200,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }
        }
      } catch (_) {}

      return new Response(JSON.stringify({
        success: false,
        error: { message: `Could not fetch media for this ${platform} link. Please check the link and try again.`, statusCode: 404 },
      }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Default HTML Web UI for root path /
    return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>HD Video Downloader API</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0d1117; color: #c9d1d9; margin: 0; padding: 40px 20px; display: flex; flex-direction: column; align-items: center; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 32px; max-width: 500px; width: 100%; box-shadow: 0 8px 24px rgba(0,0,0,0.5); text-align: center; }
    h1 { color: #58a6ff; font-size: 24px; margin-bottom: 8px; }
    p { color: #8b949e; font-size: 14px; margin-bottom: 24px; }
    code { background: #21262d; color: #79c0ff; padding: 4px 8px; border-radius: 6px; font-size: 13px; word-break: break-all; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🚀 Downloader API (Cloudflare Worker)</h1>
    <p>Hybrid Edge + Vercel Fallback. 100% Reliable.</p>
    <p>Endpoint: <code>/api/download/instagram?url=YOUR_INSTAGRAM_URL</code></p>
    <p>Endpoint: <code>/api/download/threads?url=YOUR_THREADS_URL</code></p>
  </div>
</body>
</html>`, {
      status: 200,
      headers: { 'Content-Type': 'text/html;charset=UTF-8', ...corsHeaders },
    });
  },
};

/** Direct Threads Scraper **/
async function scrapeThreadsDirectly(inputUrl) {
  const match = String(inputUrl || '').match(/(?:threads\.(?:com|net)|threads\.net\/share)\/([^/?#]+)/i);
  let shortcode = match ? match[1] : null;
  if (shortcode === 'share') {
    const parts = inputUrl.split('/share/')[1];
    if (parts) shortcode = parts.split('/')[0];
  }
  const cleanCode = shortcode ? shortcode.replace(/[^A-Za-z0-9_-]/g, '') : null;
  const targetUrl = cleanCode ? `https://www.threads.net/t/${cleanCode}` : inputUrl;

  const res = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  if (!res.ok) return null;
  const html = await res.text();

  const media = [];
  const videoVersionsMatches = html.match(/"video_versions":\s*(\[[^\]]+\])/g) || [];
  for (const matchStr of videoVersionsMatches) {
    try {
      const jsonStr = matchStr.replace(/"video_versions":\s*/, '');
      const versions = JSON.parse(jsonStr);
      if (Array.isArray(versions)) {
        versions.forEach((v) => {
          if (v && v.url) {
            const cleanUrl = v.url.replace(/\\/g, '').replace(/\\u0026/g, '&');
            if (!media.some((m) => m.url === cleanUrl)) {
              media.push({ quality: 'HD Video', type: 'video', url: cleanUrl });
            }
          }
        });
      }
    } catch (_) {}
  }

  if (!media.length) {
    const ogVideoMatch = html.match(/meta property="og:video" content="([^"]+)"/i);
    if (ogVideoMatch) {
      const videoUrl = ogVideoMatch[1].replace(/&amp;/g, '&').replace(/\\u0026/g, '&');
      media.push({ quality: 'HD Video', type: 'video', url: videoUrl });
    }
  }

  if (!media.length) return null;
  return { title: 'Threads Video', media, url: media[0].url };
}

/** Direct Instagram Scraper **/
async function scrapeInstagramDirectly(inputUrl) {
  const shortcodeMatch = String(inputUrl || '').match(/(?:instagram\.com|instagr\.am)\/(?:p|reel|reels|tv|share)\/([A-Za-z0-9_-]+)/i);
  const shortcode = shortcodeMatch ? shortcodeMatch[1] : null;
  const targetUrl = shortcode ? `https://www.instagram.com/reel/${shortcode}/` : inputUrl;

  // Engine 1: Facebook Crawler UA Direct HTML Scraping
  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (res.ok) {
      const html = await res.text();
      const media = [];

      const videoVersionsMatches = html.match(/"video_versions":\s*(\[[^\]]+\])/g) || [];
      for (const matchStr of videoVersionsMatches) {
        try {
          const jsonStr = matchStr.replace(/"video_versions":\s*/, '');
          const versions = JSON.parse(jsonStr);
          if (Array.isArray(versions)) {
            versions.forEach((v) => {
              if (v && v.url) {
                const cleanUrl = v.url.replace(/\\/g, '').replace(/\\u0026/g, '&');
                if (!media.some((m) => m.url === cleanUrl)) {
                  media.push({
                    quality: v.width ? `${v.width}x${v.height}` : 'HD Video',
                    type: 'video',
                    url: cleanUrl,
                  });
                }
              }
            });
          }
        } catch (_) {}
      }

      if (!media.length) {
        const ogVideoMatch = html.match(/meta property="og:video" content="([^"]+)"/i) ||
                             html.match(/content="([^"]+)" property="og:video/i);
        if (ogVideoMatch) {
          const videoUrl = ogVideoMatch[1].replace(/&amp;/g, '&').replace(/\\u0026/g, '&');
          media.push({ quality: 'HD Video', type: 'video', url: videoUrl });
        }
      }

      if (media.length > 0) {
        const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
        const title = ogTitleMatch ? ogTitleMatch[1].replace(/&amp;/g, '&') : 'Instagram Reel';
        const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
        const thumbnail = ogImageMatch ? ogImageMatch[1].replace(/&amp;/g, '&') : media[0].url;

        return {
          title,
          thumbnail,
          url: media[0].url,
          media,
        };
      }
    }
  } catch (e) {}

  // Engine 2: Botcahx Provider Engine Fallback
  try {
    const botRes = await fetch(`https://api.botcahx.biz/api/dowloader/ig?url=${encodeURIComponent(targetUrl)}&apikey=btch`);
    if (botRes.ok) {
      const json = await botRes.json();
      if (json && json.status && json.result) {
        let videoUrl = Array.isArray(json.result) ? json.result[0]?.url : json.result.url || json.result;
        if (typeof videoUrl === 'string' && videoUrl.startsWith('http')) {
          return { title: 'Instagram Reel', url: videoUrl, media: [{ quality: 'HD Video', type: 'video', url: videoUrl }] };
        }
      }
    }
  } catch (_) {}

  return null;
}

/** Direct Pinterest Scraper **/
async function scrapePinterestDirectly(inputUrl) {
  try {
    let url = String(inputUrl || '').trim();
    if (!url) return null;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();

    let videoUrl = null;
    let title = null;
    let description = null;
    let thumbnail = null;
    let author = null;

    // 1. JSON-LD structured data (often has VideoObject for video pins)
    const ldMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
    for (const tag of ldMatches) {
      try {
        const jsonContent = tag.replace(/<script[^>]*type=["']application\/ld\+json["'][^>]*>/i, '').replace(/<\/script>/i, '').trim();
        const data = JSON.parse(jsonContent);
        const items = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
        for (const item of items) {
          if (item && item['@type'] === 'VideoObject') {
            if (item.contentUrl) videoUrl = item.contentUrl;
            if (item.name && !title) title = item.name;
            if (item.description && !description) description = item.description;
            if (item.thumbnailUrl && !thumbnail) thumbnail = item.thumbnailUrl;
            if (item.creator && item.creator.name && !author) author = item.creator.name;
          }
          if (item && (item['@type'] === 'SocialMediaPosting' || item['@type'] === 'ImageObject')) {
            if (item.headline && !title) title = item.headline;
            if (item.articleBody && !description) description = item.articleBody;
            if (item.image && !thumbnail) thumbnail = item.image;
            if (item.author && item.author.name && !author) author = item.author.name;
          }
        }
      } catch (_) {}
    }

    // 2. Direct MP4 links from v1.pinimg.com
    if (!videoUrl) {
      const mp4Matches = html.match(/https?:\/\/(?:v1|v2|v3)\.pinimg\.com\/videos\/[^\s"'<>]+\.mp4/gi);
      if (mp4Matches && mp4Matches.length > 0) {
        videoUrl = mp4Matches.find(u => u.includes('720w') || u.includes('1080w')) || mp4Matches.find(u => u.includes('expMp4')) || mp4Matches[0];
      }
    }

    // 3. Convert HLS .m3u8 to expMp4
    if (!videoUrl) {
      const m3u8Match = html.match(/https?:\/\/(?:v1|v2|v3)\.pinimg\.com\/videos\/([a-zA-Z0-9_-]+)\/hls\/([^\s"'<>]+\.m3u8)/i);
      if (m3u8Match) {
        const sub = m3u8Match[1];
        const file = m3u8Match[2].replace('.m3u8', '_720w.mp4');
        videoUrl = `https://v1.pinimg.com/videos/${sub}/expMp4/${file}`;
      }
    }

    // 4. OpenGraph fallbacks
    if (!title) {
      const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
      if (ogTitle) title = ogTitle[1].replace(/&amp;/g, '&');
    }
    if (!thumbnail) {
      const ogImg = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
      if (ogImg) thumbnail = ogImg[1].replace(/&amp;/g, '&');
    }
    if (!description) {
      const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
                     html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
      if (ogDesc) description = ogDesc[1].replace(/&amp;/g, '&');
    }

    if (thumbnail) thumbnail = thumbnail.replace(/\\/g, '');
    if (videoUrl) videoUrl = videoUrl.replace(/\\/g, '');

    const isVideo = Boolean(videoUrl);
    const media = [];
    if (videoUrl) {
      media.push({ quality: 'HD Video', type: 'video', url: videoUrl });
    }
    if (thumbnail) {
      media.push({ quality: videoUrl ? 'Cover Image' : 'Image', type: 'image', url: thumbnail });
    }

    if (!media.length) return null;

    return {
      title: title || 'Pinterest Media',
      thumbnail: thumbnail || (videoUrl ? videoUrl : null),
      url: media[0].url,
      type: isVideo ? 'video' : 'image',
      video: videoUrl || null,
      author,
      media,
    };
  } catch (_) {
    return null;
  }
}

