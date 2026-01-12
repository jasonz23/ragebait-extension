// API endpoint - replace with your backend URL
const API_URL = "http://localhost:6767";

// Cache for ratings to avoid redundant API calls
const ratingCache = new Map();

// --- tiny style injection (only once) ---
function injectStylesOnce() {
  if (document.getElementById("rbx-styles")) return;

  const style = document.createElement("style");
  style.id = "rbx-styles";
  style.textContent = `
    .rbx-badge {
      position: relative;
      overflow: visible;

      display: flex;
      flex-direction: column;
      gap: 8px;

      padding: 10px 12px;
      border-radius: 14px;

      border: 1px solid rgba(255,255,255,0.10);
      background: rgba(0,0,0,0.55);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      box-shadow: 0 10px 30px rgba(0,0,0,0.35);

      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
      user-select: none;
      pointer-events: auto;

      width: fit-content;
      max-width: min(680px, 100%);
    }

    .rbx-row-top {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .rbx-row-bottom {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0; /* allows ellipsis */
    }

    .rbx-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 10px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.06);
      flex: 0 0 auto;
    }

    .rbx-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      box-shadow: 0 0 0 3px rgba(255,255,255,0.06);
    }

    .rbx-title {
      display: flex;
      flex-direction: column;
      line-height: 1.05;
      color: rgba(255,255,255,0.92);
    }

    .rbx-label {
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      opacity: 0.75;
    }

    .rbx-score {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.02em;
      display: inline-flex;
      align-items: baseline;
      gap: 6px;
    }

    .rbx-score strong {
      font-size: 16px;
      font-weight: 800;
    }

    .rbx-signal {
      flex: 0 0 auto;
      display: inline-flex;
      flex-direction: column;
      gap: 2px;
      min-width: 110px;
    }

    .rbx-signal .rbx-label { font-size: 10px; }
    .rbx-signal .rbx-signal-text {
      font-size: 12px;
      font-weight: 750;
      color: rgba(255,255,255,0.92);
    }

    .rbx-bar {
      position: relative;
      flex: 1 1 auto;
      min-width: 140px;
      height: 9px;
      border-radius: 999px;
      overflow: hidden;
      background: rgba(255,255,255,0.10);
      border: 1px solid rgba(255,255,255,0.10);
    }


    .rbx-bar > span {
      display: block;
      height: 100%;
      width: 0%;
      border-radius: 999px;
      transition: width 220ms ease;
    }

    .rbx-help {
      flex: 0 0 auto;
      width: 18px;
      height: 18px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(255,255,255,0.15);
      background: rgba(255,255,255,0.06);
      color: rgba(255,255,255,0.85);
      font-size: 12px;
      cursor: help;
    }

    .rbx-analysis {
      flex: 1 1 auto;
      min-width: 0;
      color: rgba(255,255,255,0.86);
      font-size: 12px;
      line-height: 1.25;
      opacity: 0.92;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .rbx-loading {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: rgba(255,255,255,0.85);
      font-size: 12px;
      opacity: 0.9;
    }

    .rbx-spinner {
      width: 12px;
      height: 12px;
      border-radius: 999px;
      border: 2px solid rgba(255,255,255,0.22);
      border-top-color: rgba(255,255,255,0.85);
      animation: rbxSpin 0.7s linear infinite;
    }

    @keyframes rbxSpin { to { transform: rotate(360deg); } }

    /* place it nicely above action bar */
    .rbx-wrap {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      margin: 6px 0 10px 0;
      overflow: visible;
    }

    .rbx-tooltip {
      position: absolute;
      bottom: calc(100% + 10px);

      /* align tooltip width to badge width */
      left: 0;
      right: 0;

      z-index: 999999;

      /* same width as badge, but never exceed viewport */
      width: auto;
      max-width: min(100%, calc(100vw - 24px));

      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(0,0,0,0.88);
      color: rgba(255,255,255,0.92);
      font-size: 12px;
      line-height: 1.35;
      box-shadow: 0 10px 30px rgba(0,0,0,0.45);

      opacity: 0;
      transform: translateY(6px);
      transition: opacity 140ms ease, transform 140ms ease;
      pointer-events: none;

      /* prevent huge tooltips from overflowing vertically */
      max-height: min(240px, calc(100vh - 140px));
      overflow: auto;

      /* wrap long text */
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;

      /* nicer scrolling */
      scrollbar-width: thin;
    }

    .rbx-badge:hover .rbx-tooltip {
      opacity: 1;
      transform: translateY(0);
    }

    .rbx-acc {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 9px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.14);
      background: rgba(255,255,255,0.06);
      color: rgba(255,255,255,0.9);
      font-size: 11px;
      font-weight: 750;
    }

    .rbx-acc .rbx-dot {
      width: 7px;
      height: 7px;
      box-shadow: 0 0 0 3px rgba(255,255,255,0.05);
    }

    @media (max-width: 520px) {
      .rbx-row-top { flex-wrap: wrap; }
      .rbx-bar { min-width: 120px; }
      .rbx-row-bottom { flex-wrap: wrap; row-gap: 8px; }
      .rbx-analysis { flex-basis: 100%; }
    }
  `;
  document.head.appendChild(style);
}

// --- helpers ---
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function scoreToTheme(score0to100) {
  const s = clamp(score0to100, 0, 100);

  // 0 = Hopium, 50 = Neutral, 100 = Ragebait
  if (s <= 20) {
    return {
      label: "Strong Hopium",
      dot: "#22c55e",
      fill: "linear-gradient(90deg, #22c55e, #86efac)",
      axis: "Hopium",
    };
  }
  if (s <= 40) {
    return {
      label: "Mild Hopium",
      dot: "#10b981",
      fill: "linear-gradient(90deg, #10b981, #34d399)",
      axis: "Hopium",
    };
  }
  if (s < 60) {
    return {
      label: "Neutral",
      dot: "#a3a3a3",
      fill: "linear-gradient(90deg, #a3a3a3, #e5e5e5)",
      axis: "Neutral",
    };
  }
  if (s < 80) {
    return {
      label: "Rage-leaning",
      dot: "#f59e0b",
      fill: "linear-gradient(90deg, #f59e0b, #fbbf24)",
      axis: "Ragebait",
    };
  }
  return {
    label: "High Ragebait",
    dot: "#ef4444",
    fill: "linear-gradient(90deg, #fb7185, #ef4444)",
    axis: "Ragebait",
  };
}

// Extract post ID from Twitter's data attributes or URL
function getPostId(article) {
  const link = article.querySelector('a[href*="/status/"]');
  if (link) {
    const match = link.href.match(/\/status\/(\d+)/);
    return match ? match[1] : null;
  }
  return null;
}

function getPostMediaUrls(article) {
  const urls = new Set();

  // Photos (Twitter/X usually renders <img> tags for media)
  // We try a few selectors because X changes DOM a lot.
  const imgCandidates = article.querySelectorAll(
    'img[src*="twimg.com/media"], img[src*="pbs.twimg.com/media"], img[data-testid="tweetPhoto"] img, img'
  );

  for (const img of imgCandidates) {
    const src = img.currentSrc || img.src;
    if (!src) continue;

    // Heuristic: only keep likely media images
    if (
      src.includes("twimg.com/media") ||
      src.includes("pbs.twimg.com/media")
    ) {
      // Strip common sizing params so backend can fetch original if desired
      const clean = src
        .replace(/([?&])(name|format|w|h)=[^&]+/g, "$1")
        .replace(/[?&]$/g, "");
      urls.add(clean);
    }
  }

  // Videos/GIFs: often there's a <video poster="..."> (poster is an image URL)
  const videos = article.querySelectorAll("video[poster]");
  for (const v of videos) {
    if (v.poster) urls.add(v.poster);
  }

  // Return up to 4 media items (tweets can have 1–4 images)
  return Array.from(urls).slice(0, 4);
}

// Extract post content text
function getPostContent(article) {
  const textElement = article.querySelector('[data-testid="tweetText"]');
  return textElement ? textElement.innerText : "";
}

// --- messaging helper: Promise wrapper for sendMessage (more reliable than await sendMessage) ---
function sendMessagePromise(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const err = chrome.runtime.lastError;
      if (err) return reject(new Error(err.message));
      resolve(response);
    });
  });
}

// Get rating from backend API (via background)
async function getRating(postId, content, mediaUrls = []) {
  if (ratingCache.has(postId)) return ratingCache.get(postId);

  try {
    const res = await sendMessagePromise({
      action: "analyzePost",
      payload: { postId, content, mediaUrls },
    });

    if (!res || res.error) throw new Error(res?.error || "No response");

    // ✅ matches your API: rageBaitScore is 0–100, analysis is string
    const rageBaitScore =
      typeof res.rageBaitScore === "number" ? res.rageBaitScore : 0;
    const analysis = typeof res.analysis === "string" ? res.analysis : "";
    const accuracyScore =
      typeof res.accuracyScore === "string" ? res.accuracyScore : "Low";

    const payload = { rageBaitScore, analysis, accuracyScore };
    ratingCache.set(postId, payload);

    return payload;
  } catch (err) {
    console.error("Error fetching rating:", err);
    return null;
  }
}

// Create and inject rating badge (cooler, matches API)
function createRatingBadge({ rageBaitScore, analysis, accuracyScore }) {
  injectStylesOnce();

  const score = clamp(rageBaitScore ?? 0, 0, 100);
  const theme = scoreToTheme(score);

  const badge = document.createElement("div");
  badge.className = "rbx-badge";
  badge.setAttribute("role", "note");

  // Title tooltip shows full analysis (so even if truncated, you can hover)
  const analysisText = (analysis || "").trim();

  const safeAnalysis = (analysisText || "No analysis")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

  const acc = (accuracyScore || "Low").toString();
  const accNorm = acc[0].toUpperCase() + acc.slice(1).toLowerCase(); // High/Medium/Low

  const accTheme =
    accNorm === "High"
      ? { label: "High", dot: "#10b981" }
      : accNorm === "Medium"
      ? { label: "Medium", dot: "#f59e0b" }
      : { label: "Low", dot: "#ef4444" };

  badge.innerHTML = `
  <div class="rbx-row-top">
    <div class="rbx-chip">
      <span class="rbx-dot" style="background:${theme.dot};"></span>
      <div class="rbx-title">
        <span class="rbx-label">Framing</span>
        <span class="rbx-score"><strong>${score.toFixed(
          0
        )}</strong><span>/100</span></span>
      </div>
    </div>

    <div class="rbx-bar" aria-label="ragebait score bar">
      <span style="background:${theme.fill}; width:${score}%;"></span>
    </div>
  </div>

  <div class="rbx-row-bottom">
    <div class="rbx-signal">
      <span class="rbx-label">Axis</span>
      <span class="rbx-signal-text">${theme.axis} — ${theme.label}</span>
    </div>

    <div class="rbx-acc" title="Confidence based on evidence quality / verifiability from text alone">
      <span class="rbx-dot" style="width:7px;height:7px;background:${
        accTheme.dot
      };"></span>
      <span>Accuracy: ${accTheme.label}</span>
    </div>

    ${
      analysisText
        ? `<div class="rbx-analysis">${analysisText}</div>`
        : `<div class="rbx-analysis" style="opacity:0.6;">No analysis</div>`
    }

  </div>

  <div class="rbx-tooltip">${safeAnalysis}</div>
`;

  return badge;
}

// Create a loading badge while we wait for API (nice UX)
function createLoadingBadge() {
  injectStylesOnce();
  const badge = document.createElement("div");
  badge.className = "rbx-badge";
  badge.innerHTML = `
    <div class="rbx-loading">
      <span class="rbx-spinner"></span>
      <span>Analyzing ragebait…</span>
    </div>
  `;
  return badge;
}

// Process a single post
async function processPost(article) {
  // Skip if already processed
  if (article.dataset.ratingProcessed) return;

  const postId = getPostId(article);
  if (!postId) return;

  const content = getPostContent(article);
  if (!content) return;

  const mediaUrls = getPostMediaUrls(article);

  // Mark as processed
  article.dataset.ratingProcessed = "true";

  // Find the action bar (like, retweet, etc.)
  const actionBar = article.querySelector('[role="group"]');
  if (!actionBar) return;

  const container = actionBar.parentElement;
  if (!container) return;

  container.style.position = "relative";

  // Add a wrap so layout is consistent
  const wrap = document.createElement("div");
  wrap.className = "rbx-wrap";

  // Show loading UI immediately
  const loadingBadge = createLoadingBadge();
  wrap.appendChild(loadingBadge);

  container.insertBefore(wrap, actionBar);

  // Get rating
  const result = await getRating(postId, content, mediaUrls);
  if (result === null) {
    // remove loading if failed
    wrap.remove();
    return;
  }

  // Replace loading with real badge
  const badge = createRatingBadge(result);
  wrap.replaceChildren(badge);
}

// Observe DOM changes to process new posts
function observePosts() {
  const observer = new MutationObserver(() => {
    const articles = document.querySelectorAll('article[data-testid="tweet"]');
    articles.forEach((article) => processPost(article));
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Process existing posts
  const articles = document.querySelectorAll('article[data-testid="tweet"]');
  articles.forEach((article) => processPost(article));
}

// Initialize when page loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", observePosts);
} else {
  observePosts();
}
