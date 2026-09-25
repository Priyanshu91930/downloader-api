/**
 * Central registry of every supported platform.
 *
 * Adding a new platform later only requires adding one entry here —
 * the route, controller, and frontend dropdown all read from this file.
 *
 * `fn`        -> the exported function name inside the `btch-downloader` package
 * `queryType` -> "url" or "query" (a couple of platforms accept a free-text search string)
 * `example`   -> sample input shown in the frontend tester
 */
const PLATFORMS = {
  // "aio" ("all-in-one") auto-detects the platform from the URL and delegates
  // to the matching downloader below. As of btch-downloader v6, the upstream
  // README marks this function "no longer maintained" — it's kept here for
  // backwards compatibility with existing integrations, but new callers
  // should target a specific platform route instead of relying on this one.
  aio: {
    fn: "aio",
    queryType: "url",
    example: "https://www.tiktok.com/@user/video/1234567890",
    note: "Auto-detects the platform from the URL and delegates to the matching downloader.",
    deprecated: true,
  },
  tiktok: { fn: "ttdl", queryType: "url", example: "https://www.tiktok.com/@user/video/1234567890" },
  instagram: { fn: "igdl", queryType: "url", example: "https://www.instagram.com/reel/xxxxxxxxxxx/" },
  facebook: { fn: "fbdown", queryType: "url", example: "https://www.facebook.com/watch/?v=1234567890" },
  twitter: { fn: "twitter", queryType: "url", example: "https://twitter.com/user/status/1234567890" },
  youtube: { fn: "youtube", queryType: "url", example: "https://youtu.be/xxxxxxxxxxx" },
  "youtube-search": { fn: "yts", queryType: "query", example: "Somewhere Only We Know" },
  spotify: { fn: "spotify", queryType: "url", example: "https://open.spotify.com/track/xxxxxxxxxxxxxxxxxxxxxx" },
  soundcloud: { fn: "soundcloud", queryType: "url", example: "https://soundcloud.com/artist/track-name" },
  pinterest: { fn: "pinterest", queryType: "url_or_query", example: "https://pin.it/xxxxxxx (or a search term)" },
  // "mediafire" is also marked "no longer maintained" upstream as of v6 —
  // still wired up (it may keep working for a while), but expect it to be
  // the first thing to break on a future btch-downloader upgrade.
  mediafire: {
    fn: "mediafire",
    queryType: "url",
    example: "https://www.mediafire.com/file/xxxxxxxxxxx/name/file",
    deprecated: true,
  },
  gdrive: { fn: "gdrive", queryType: "url", example: "https://drive.google.com/file/d/xxxxxxxxxxx/view" },
  capcut: { fn: "capcut", queryType: "url", example: "https://www.capcut.com/template-detail/xxxxxxxxxxx" },
  douyin: { fn: "douyin", queryType: "url", example: "https://v.douyin.com/xxxxxxx/" },
  xiaohongshu: { fn: "xiaohongshu", queryType: "url", example: "https://xhslink.com/o/xxxxxxxxxxx" },
  "xiaohongshu-profile": {
    fn: "xiaohongshuProfile",
    queryType: "url",
    example: "https://www.xiaohongshu.com/user/profile/xxxxxxxxxxxxxxxxxxxxxxxx",
  },
  snackvideo: { fn: "snackvideo", queryType: "url", example: "https://s.snackvideo.com/p/xxxxxxxx" },
  cocofun: { fn: "cocofun", queryType: "url", example: "https://www.icocofun.com/share/post/xxxxxxxxxxx" },
  threads: { fn: "threads", queryType: "url", example: "https://www.threads.com/@user/post/xxxxxxxxxxx" },
  kuaishou: { fn: "kuaishou", queryType: "url", example: "https://v.kuaishou.com/xxxxxxx" },
};

module.exports = { PLATFORMS };
