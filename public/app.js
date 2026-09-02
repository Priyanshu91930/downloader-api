// Safe JSON.stringify: tolerates circular references (replaced inline
// instead of throwing) and never lets a serialization failure crash the
// render — falls back to a readable message instead of an uncaught
// exception. Parsed API responses can't actually be circular, but this
// guards any future data path (e.g. a localStorage history feature) that
// might stringify something less guaranteed-safe.
function safeStringify(value, indent = 2) {
  const seen = new WeakSet();
  try {
    return JSON.stringify(
      value,
      (key, val) => {
        if (typeof val === "object" && val !== null) {
          if (seen.has(val)) return "[Circular]";
          seen.add(val);
        }
        return val;
      },
      indent
    );
  } catch (err) {
    return `[Could not display response: ${err.message}]`;
  }
}

const platformSelect = document.getElementById("platform");
  const inputEl = document.getElementById("input");
  const inputLabel = document.getElementById("inputLabel");
  const exampleText = document.getElementById("exampleText");
  const fetchBtn = document.getElementById("fetchBtn");
  const endpointLine = document.getElementById("endpointLine");
  const resultBox = document.getElementById("resultBox");
  const rawToggle = document.getElementById("rawToggle");
  const copyResponseBtn = document.getElementById("copyResponseBtn");

  rawToggle.addEventListener("change", () => {
    resultBox.style.display = rawToggle.checked ? "block" : "none";
  });

  // Tracks the raw response text (not read from resultBox.textContent at
  // click time) so copying still works correctly even while the panel is
  // toggled hidden — the text content is set regardless of display state.
  let lastResponseText = null;

  copyResponseBtn.addEventListener("click", async () => {
    if (!lastResponseText) return;
    try {
      await navigator.clipboard.writeText(lastResponseText);
      copyResponseBtn.textContent = "Copied!";
      copyResponseBtn.classList.add("copied");
    } catch {
      // Clipboard API can be unavailable (insecure context, permissions,
      // older browsers) — fall back to a manual select so the user can
      // still copy it themselves via Ctrl/Cmd+C instead of the button
      // silently doing nothing.
      const range = document.createRange();
      range.selectNodeContents(resultBox);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      copyResponseBtn.textContent = "Selected — press Ctrl/Cmd+C";
    }
    setTimeout(() => {
      copyResponseBtn.textContent = "Copy";
      copyResponseBtn.classList.remove("copied");
    }, 1800);
  });

  const resultBadge = document.getElementById("resultBadge");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");

  let platforms = {};

  // Ordered so a more specific host match wins before a looser one.
  const DETECT_PATTERNS = [
    [/tiktok\.com/i, "tiktok"],
    [/instagram\.com/i, "instagram"],
    [/(facebook\.com|fb\.watch)/i, "facebook"],
    [/(twitter\.com|x\.com)/i, "twitter"],
    [/(youtube\.com|youtu\.be)/i, "youtube"],
    [/open\.spotify\.com/i, "spotify"],
    [/soundcloud\.com/i, "soundcloud"],
    [/(pinterest\.[a-z.]+|pin\.it)/i, "pinterest"],
    [/mediafire\.com/i, "mediafire"],
    [/drive\.google\.com/i, "gdrive"],
    [/capcut\.com/i, "capcut"],
    [/douyin\.com/i, "douyin"],
    [/(xiaohongshu\.com|xhslink\.com)/i, "xiaohongshu"],
    [/snackvideo\.com/i, "snackvideo"],
    [/(icocofun\.com|cocofun\.com)/i, "cocofun"],
  ];

  function detectPlatform(value) {
    const v = String(value || '').trim();
    if (!v) return null;
    // Allow pasted links without a protocol (e.g. "youtube.com/...") by
    // prepending a dummy http:// when testing patterns.
    const testValue = /^https?:\/\//i.test(v) ? v : 'http://' + v;

    for (const [pattern, key] of DETECT_PATTERNS) {
      if (pattern.test(testValue) && platforms[key]) return key;
    }
    return null;
  }

  function maybeAutoSelect() {
    const detected = detectPlatform(inputEl.value);
    if (detected && platformSelect.value !== detected) {
      platformSelect.value = detected;
      updateInputUI();
    }
  }

  function paramName(queryType) {
    return queryType === "query" ? "query" : "url";
  }

  function updateInputUI() {
    const key = platformSelect.value;
    const cfg = platforms[key];
    if (!cfg) return;
    const p = paramName(cfg.queryType);
    inputLabel.textContent = cfg.queryType === "url_or_query" ? "Url or search query" : p === "query" ? "Search query" : "Url";
    inputEl.placeholder = cfg.example;
    exampleText.textContent = "e.g. " + cfg.example;
    updateEndpointLine();
  }

  function updateEndpointLine() {
    const key = platformSelect.value;
    const cfg = platforms[key];
    if (!cfg) return;
    const p = paramName(cfg.queryType);
    const val = inputEl.value.trim() || `{${p}}`;
    endpointLine.innerHTML = `<span class="method">GET</span> /api/download/${key}?${p}=${encodeURIComponent(val)}`;
  }

  async function loadPlatforms() {
    try {
      const res = await fetch("/api/platforms");
      const data = await res.json();
      platforms = Object.fromEntries(data.platforms.map((p) => [p.key, p]));
      const keys = Object.keys(platforms);
      platformSelect.innerHTML = keys
        .map((key) => `<option value="${key}">${key}</option>`)
        .join("");
      // Ensure a sensible default is selected (first platform) so auto-detect can set correctly.
      if (!keys.includes(platformSelect.value)) platformSelect.value = keys[0] || "";
      updateInputUI();
      // Try auto-selecting now in case the user pasted before platforms finished loading.
      maybeAutoSelect();
    } catch (err) {
      endpointLine.textContent = "Could not load platform list — is the server running?";
    }
  }

  async function checkHealth() {
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        statusDot.classList.add("up");
        statusText.textContent = "server online";
      } else {
        throw new Error();
      }
    } catch {
      statusDot.classList.add("down");
      statusText.textContent = "server unreachable";
    }
  }

  const mediaCards = document.getElementById("mediaCards");

  const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|$)/i;
  const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|wav)(\?|$)/i;
  const IMAGE_EXT = /\.(jpe?g|png|gif|webp)(\?|$)/i;

  function classifyMedia(key, url) {
    const k = String(key || "").toLowerCase();
    // Direct extension-as-keyname check first — some platforms name fields
    // literally "mp3"/"mp4" (e.g. YouTube's { mp3, mp4 } shape) rather than
    // "video"/"audio", which the broader keyword check below wouldn't catch.
    if (/mp4|webm|\bmov\b|m4v/.test(k)) return "video";
    if (/mp3|m4a|\baac\b|\bwav\b|\bogg\b/.test(k)) return "audio";
    if (/jpe?g|\bpng\b|\bgif\b|webp/.test(k)) return "image";
    if (VIDEO_EXT.test(url) || /video/.test(k)) return "video";
    if (AUDIO_EXT.test(url) || /(audio|music|song)/.test(k)) return "audio";
    if (IMAGE_EXT.test(url) || /(image|thumb|photo|cover)/.test(k)) return "image";
    return "file";
  }

  function isUrlString(v) {
    return typeof v === "string" && /^https?:\/\/\S+$/i.test(v);
  }

  function isThumbKey(k) {
    return /thumb|cover|poster/i.test(String(k || ""));
  }

  // Collects {key, url, isThumb} pairs from an item-shaped object, bounded to
  // a shallow nesting depth (handles shapes like images.orig.url without
  // wandering arbitrarily deep into unrelated structures).
  function extractVariants(node, keyHint, depth, seen, out) {
    if (node == null || depth > 3) return out;
    if (typeof node === "string") {
      if (isUrlString(node) && !seen.has(node)) {
        seen.add(node);
        out.push({ key: keyHint || "media", url: node, isThumb: isThumbKey(keyHint) });
      }
      return out;
    }
    if (Array.isArray(node)) {
      node.forEach((v) => extractVariants(v, keyHint, depth + 1, seen, out));
      return out;
    }
    if (typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        // "url" is a generic, non-descriptive wrapper property name (e.g.
        // images.orig.url, images["736x"].url) — keep the parent's more
        // meaningful key ("orig", "736x") as the label instead of letting
        // every such nested url collapse to the same literal key "url".
        const nextKeyHint = k.toLowerCase() === "url" && keyHint ? keyHint : k;
        extractVariants(v, nextKeyHint, depth + 1, seen, out);
      }
    }
    return out;
  }

  function getVariants(obj) {
    return extractVariants(obj, null, 0, new Set(), []);
  }

  // A genuine list entry (a Pinterest search result, a YouTube search hit)
  // is a real record with multiple identifying fields — title, id, image,
  // etc. A bare single-key object like {hd: "..."} or {sd: "..."} is just a
  // quality/format variant written as an array element instead of a flat
  // object property, and should stay part of the SAME item's variant list,
  // not get split into its own unrelated-looking card.
  function looksLikeListItem(item) {
    return Object.keys(item).length > 1;
  }

  // Some platforms (search results, Pinterest boards) wrap a list of
  // distinct results under a field like `data`/`results`/`items` rather than
  // returning the array directly. Detect that shape so each result renders
  // as its own card instead of every URL in the tree getting flattened
  // together into one jumbled grid.
  function findListField(resultObj) {
    for (const [k, v] of Object.entries(resultObj)) {
      if (Array.isArray(v) && v.length && v.every((el) => el && typeof el === "object" && !Array.isArray(el))) {
        const withVariants = v.filter((el) => getVariants(el).length > 0);
        const withMultipleFields = v.filter(looksLikeListItem);
        if (withVariants.length >= Math.ceil(v.length / 2) && withMultipleFields.length >= Math.ceil(v.length / 2)) {
          return { key: k, list: v };
        }
      }
    }
    return null;
  }

  // Builds one renderable "item" out of a result object: a title (if any),
  // a thumbnail pulled out separately from the downloadable options, and the
  // remaining URLs as quality/format variants. A single video with
  // hd/sd/audio links becomes ONE item with 3 variants (dropdown), not 3
  // separate cards.
  function buildItem(obj) {
    const title = obj.title || obj.caption || obj.desc || obj.description || obj.name || obj.filename || null;
    const allVariants = getVariants(obj);
    const thumbVariant = allVariants.find((v) => v.isThumb) || null;
    const downloadVariants = allVariants.filter((v) => v !== thumbVariant);
    const variants = withInferredTypes(downloadVariants.length ? downloadVariants : allVariants);
    return { title, thumbnail: thumbVariant ? thumbVariant.url : null, variants };
  }

  // Precomputes each variant's media type once (instead of recalculating it
  // ad hoc at render time), then fills in any that came back unclassified
  // ("file") IF every other classified sibling in this same item agrees on
  // one single real type. This is what fixes shapes like Facebook's
  // { Normal_video, HD } — "Normal_video" matches the video keyword, "HD"
  // alone doesn't, but since they're clearly two quality options of the
  // same download, "HD" should inherit "video" rather than showing as a
  // generic, unpreviewable file. Left alone when an item genuinely mixes
  // more than one real type (e.g. TikTok's separate video[]/audio[] — both
  // already classify correctly via keyword, so there's nothing to infer).
  function withInferredTypes(variants) {
    const withTypes = variants.map((v) => ({ ...v, type: classifyMedia(v.key, v.url) }));
    const knownTypes = new Set(withTypes.filter((v) => v.type !== "file").map((v) => v.type));
    if (knownTypes.size === 1) {
      const [onlyType] = knownTypes;
      for (const v of withTypes) {
        if (v.type === "file") v.type = onlyType;
      }
    }
    return withTypes;
  }

  // Top-level classification: is this response ONE item (optionally with
  // multiple quality variants), or a LIST of distinct items (YouTube/Pinterest
  // search-style results)? Both cases previously got flattened into the same
  // grid, which is what was breaking on those platforms.
  function analyzeResult(result) {
    if (Array.isArray(result)) {
      return { mode: "list", items: result.map((r) => buildItem(r)) };
    }
    if (result && typeof result === "object") {
      const listField = findListField(result);
      if (listField) {
        return { mode: "list", items: listField.list.map((r) => buildItem(r)) };
      }
      return { mode: "single", items: [buildItem(result)] };
    }
    return { mode: "single", items: [] };
  }

  function buildProxyUrl(platform, index, url) {
    const filenameBase = (platform || "media") + "-" + (index + 1);
    return `/api/fetch-media?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filenameBase)}`;
  }

  function buildPreviewHtml(type, url, altText) {
    if (type === "video") return `<video src="${url}" controls preload="metadata"></video>`;
    if (type === "audio") return `<audio src="${url}" controls></audio>`;
    if (type === "image") return `<img src="${url}" loading="lazy" alt="${altText}" />`;
    return "";
  }

  function renderItemCard(item, index, platform) {
    const card = document.createElement("div");
    card.className = "media-card";

    const hasVariants = item.variants.length > 1;
    const activeVariant = item.variants[0] || null;
    const type = activeVariant ? activeVariant.type : "file";

    // If we have a real thumbnail, that's a stable preview regardless of
    // which quality/format variant gets picked below. Otherwise the preview
    // IS the currently-selected variant, so it needs to update when the
    // dropdown changes — wrapped in its own container so we can swap it.
    const usesFixedThumbnail = Boolean(item.thumbnail && type !== "image");
    const initialPreview = usesFixedThumbnail
      ? `<img src="${item.thumbnail}" loading="lazy" alt="${item.title || "thumbnail"}" />`
      : activeVariant
        ? buildPreviewHtml(type, activeVariant.url, item.title || "media")
        : "";

    const selectHtml = hasVariants
      ? `<select class="media-variant-select">
          ${item.variants
            .map((v, i) => `<option value="${i}">${v.key} · ${v.type}</option>`)
            .join("")}
        </select>`
      : "";

    const titleHtml = item.title ? `<div class="media-card-title">${item.title}</div>` : "";

    card.innerHTML = `
      <div class="media-preview">${initialPreview}</div>
      <div class="media-card-body">
        ${titleHtml}
        <div class="media-card-label">${activeVariant ? activeVariant.key : "no media"} · ${type}</div>
        ${selectHtml}
        <button type="button" class="media-download-btn">⬇ Download</button>
        <div class="media-download-status" style="display:none;"></div>
      </div>
    `;

    if (!item.variants.length) {
      const btn = card.querySelector(".media-download-btn");
      btn.disabled = true;
      btn.textContent = "No downloadable link";
      return card;
    }

    const select = card.querySelector(".media-variant-select");
    const btn = card.querySelector(".media-download-btn");
    const label = card.querySelector(".media-card-label");
    const previewContainer = card.querySelector(".media-preview");
    btn.dataset.proxyUrl = buildProxyUrl(platform, index, activeVariant.url);

    if (select) {
      select.addEventListener("change", () => {
        const chosen = item.variants[Number(select.value)];

        btn.dataset.proxyUrl = buildProxyUrl(platform, index, chosen.url);
        label.textContent = `${chosen.key} · ${chosen.type}`;

        // Only swap the live preview if it isn't pinned to a fixed thumbnail —
        // switching HD/SD/audio should actually reflect what you're about to
        // download, not silently keep showing whatever loaded first.
        if (!usesFixedThumbnail) {
          previewContainer.innerHTML = buildPreviewHtml(chosen.type, chosen.url, item.title || "media");
        }
      });
    }

    return card;
  }

  function renderMediaCards(data) {
    mediaCards.innerHTML = "";

    if (!data || !data.success || !data.result) {
      mediaCards.innerHTML = '<div class="media-empty">No media to show.</div>';
      return;
    }

    const { items } = analyzeResult(data.result);

    if (!items.length || items.every((item) => !item.variants.length)) {
      mediaCards.innerHTML = '<div class="media-empty">No downloadable links found in this response.</div>';
      return;
    }

    const grid = document.createElement("div");
    grid.className = "media-grid";

    items.forEach((item, i) => {
      grid.appendChild(renderItemCard(item, i, data.platform));
    });

    mediaCards.appendChild(grid);

    // JS-driven download instead of a plain <a download> link: a bare link
    // can't tell the difference between a real file and an upstream error
    // page — it just saves whatever bytes come back. Fetching first lets us
    // check the response actually succeeded, use the server's real filename
    // (correct extension), and show a clear error instead of silently
    // handing over a broken file.
    mediaCards.querySelectorAll(".media-download-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const proxyUrl = btn.dataset.proxyUrl;
        const statusEl = btn.nextElementSibling;
        const originalLabel = btn.textContent;

        btn.disabled = true;
        btn.textContent = "Downloading…";
        statusEl.style.display = "none";

        try {
          const res = await fetch(proxyUrl);
          if (!res.ok) {
            let message = `Download failed (${res.status})`;
            try {
              const errBody = await res.json();
              if (errBody?.message) message = errBody.message;
            } catch {
              // response wasn't JSON — keep the generic message
            }
            throw new Error(message);
          }

          const disposition = res.headers.get("content-disposition") || "";
          const nameMatch = disposition.match(/filename="([^"]+)"/);
          const filename = nameMatch ? nameMatch[1] : "download";

          const blob = await res.blob();
          const objectUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = objectUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(objectUrl);

          btn.textContent = "✔ Saved";
          setTimeout(() => {
            btn.textContent = originalLabel;
            btn.disabled = false;
          }, 1500);
        } catch (err) {
          statusEl.textContent = String(err.message || err);
          statusEl.style.display = "block";
          btn.textContent = originalLabel;
          btn.disabled = false;
        }
      });
    });
  }

  let isFetching = false;

  async function runFetch() {
    // Guards both entry points (the button click and the Enter-key
    // shortcut below) against firing a second overlapping request — the
    // button's own `disabled` state alone doesn't stop the keydown
    // listener from calling this directly, so rapid Enter presses could
    // previously kick off multiple concurrent fetches racing to render
    // whichever response happened to land last.
    if (isFetching) return;

    const key = platformSelect.value;
    const cfg = platforms[key];
    const value = inputEl.value.trim();

    if (!value) {
      inputEl.focus();
      return;
    }

    isFetching = true;
    fetchBtn.disabled = true;
    fetchBtn.textContent = "Fetching…";
    resultBadge.style.display = "none";
    resultBox.innerHTML = '<span class="empty-state">Loading…</span>';
    lastResponseText = null;
    copyResponseBtn.disabled = true;

    const p = paramName(cfg.queryType);
    const url = `/api/download/${key}?${p}=${encodeURIComponent(value)}`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      resultBadge.style.display = "inline-block";
      resultBadge.textContent = res.status + (data.success ? " success" : " error");
      resultBadge.className = "badge " + (data.success ? "ok" : "err");

      lastResponseText = safeStringify(data);
      resultBox.textContent = lastResponseText;
      copyResponseBtn.disabled = false;
      renderMediaCards(data);
      if (data.success) addHistoryEntry(key, value);
    } catch (err) {
      resultBadge.style.display = "inline-block";
      resultBadge.textContent = "network error";
      resultBadge.className = "badge err";
      lastResponseText = String(err);
      resultBox.textContent = lastResponseText;
      copyResponseBtn.disabled = false;
      mediaCards.innerHTML = "";
    } finally {
      isFetching = false;
      fetchBtn.disabled = false;
      fetchBtn.textContent = "Fetch";
    }
  }

  // --- Recent history (localStorage) ---
  const HISTORY_KEY = "btch-downloader-history";
  const MAX_HISTORY = 20;
  const historyPanel = document.getElementById("historyPanel");
  const historyList = document.getElementById("historyList");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");

  // localStorage can throw (private browsing in some browsers, storage
  // disabled by policy, quota exceeded) — history is a nice-to-have, so
  // every access here is defensive and simply degrades to "no history"
  // rather than breaking the rest of the page.
  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveHistory(entries) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
    } catch {
      // Storage unavailable/full — silently skip persisting; the in-memory
      // render for this page load still reflects the attempted entry.
    }
  }

  function addHistoryEntry(platform, query) {
    const entries = loadHistory().filter((e) => !(e.platform === platform && e.query === query));
    entries.unshift({ platform, query, ts: Date.now() });
    saveHistory(entries.slice(0, MAX_HISTORY));
    renderHistory();
  }

  function renderHistory() {
    const entries = loadHistory();
    historyPanel.style.display = entries.length ? "block" : "none";
    historyList.innerHTML = "";

    for (const entry of entries) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "history-item";
      item.innerHTML = `
        <span class="history-platform">${entry.platform}</span>
        <span class="history-query">${entry.query}</span>
      `;
      item.addEventListener("click", () => {
        platformSelect.value = entry.platform;
        updateInputUI();
        inputEl.value = entry.query;
        updateEndpointLine();
        inputEl.focus();
      });
      historyList.appendChild(item);
    }
  }

  clearHistoryBtn.addEventListener("click", () => {
    saveHistory([]);
    renderHistory();
  });

  platformSelect.addEventListener("change", updateInputUI);
  inputEl.addEventListener("input", () => {
    maybeAutoSelect();
    updateEndpointLine();
  });
  // Ensure pasted content triggers detection after the input value is updated by the browser.
  inputEl.addEventListener("paste", () => setTimeout(() => { maybeAutoSelect(); updateEndpointLine(); }, 0));
  // Also handle drops onto the input (drag & drop)
  inputEl.addEventListener("drop", () => setTimeout(() => { maybeAutoSelect(); updateEndpointLine(); }, 0));
  inputEl.addEventListener("keydown", (e) => { if (e.key === "Enter") runFetch(); });
  fetchBtn.addEventListener("click", runFetch);

  loadPlatforms();
  checkHealth();
  renderHistory();
