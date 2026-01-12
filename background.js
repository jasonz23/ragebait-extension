const API_URL = "http://localhost:6767";
const BE_API_KEY = "analyze-dev";
const AUTH_STORAGE_KEY = "authSession";
const tweetMediaCache = new Map();

function cleanMediaUrl(url) {
  if (!url) return null;
  return url.replace(/([?&])(name|format|w|h)=[^&]+/g, "$1").replace(/[?&]$/g, "");
}

function recordTweetMedia(tweet) {
  if (!tweet?.rest_id || !tweet?.legacy) return;

  const media =
    tweet.legacy?.extended_entities?.media || tweet.legacy?.entities?.media || [];
  if (!Array.isArray(media) || media.length === 0) return;

  const urls = media
    .filter((item) => item?.type === "photo")
    .map((item) => cleanMediaUrl(item?.media_url_https || item?.media_url))
    .filter(Boolean);

  if (urls.length > 0) {
    tweetMediaCache.set(tweet.rest_id, Array.from(new Set(urls)).slice(0, 4));
  }
}

function walkGraphqlResponse(node, visited = new Set()) {
  if (!node || typeof node !== "object") return;
  if (visited.has(node)) return;
  visited.add(node);

  if (node.__typename === "Tweet" && node.rest_id) {
    recordTweetMedia(node);
  }

  for (const value of Object.values(node)) {
    if (value && typeof value === "object") {
      walkGraphqlResponse(value, visited);
    }
  }
}

function handleGraphqlResponseBody(bodyText) {
  if (!bodyText) return;
  try {
    const parsed = JSON.parse(bodyText);
    walkGraphqlResponse(parsed);
  } catch (err) {
    console.warn("Failed to parse GraphQL response:", err);
  }
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const filter = chrome.webRequest.filterResponseData(details.requestId);
    const decoder = new TextDecoder("utf-8");
    let body = "";

    filter.ondata = (event) => {
      body += decoder.decode(event.data, { stream: true });
      filter.write(event.data);
    };

    filter.onend = () => {
      body += decoder.decode();
      handleGraphqlResponseBody(body);
      filter.disconnect();
    };
  },
  {
    urls: [
      "https://twitter.com/i/api/graphql/*",
      "https://x.com/i/api/graphql/*",
    ],
  },
  ["blocking"]
);

function getAuthSession() {
  return new Promise((resolve) => {
    chrome.storage.local.get([AUTH_STORAGE_KEY], (result) => {
      resolve(result[AUTH_STORAGE_KEY] || null);
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("Twitter Post Rater extension installed");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "clearCache") {
    chrome.storage.local.get(null, (items) => {
      const keysToRemove = Object.keys(items).filter(
        (key) => ![AUTH_STORAGE_KEY, "enabled"].includes(key)
      );
      chrome.storage.local.remove(keysToRemove, () =>
        sendResponse({ success: true })
      );
    });
    return true;
  }

  if (request.action === "analyzePost") {
    (async () => {
      try {
        const authSession = await getAuthSession();
        if (!authSession?.accessToken) {
          sendResponse({ error: "Not authenticated." });
          return;
        }

        const response = await fetch(`${API_URL}/analyze`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": BE_API_KEY,
            Authorization: `Bearer ${authSession.accessToken}`,
          },
          body: JSON.stringify(request.payload),
        });

        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(
            `API ${response.status}: ${text || "Request failed"}`
          );
        }

        const data = await response.json();
        // Expecting { rating: number } from your backend
        sendResponse({
          rageBaitScore: data?.rageBaitScore ?? 0,
          analysis: data?.analysis ?? "",
          accuracyScore: data?.accuracyScore ?? "Low",
        });
      } catch (err) {
        sendResponse({ error: String(err?.message || err) });
      }
    })();

    return true; // keep channel open for async
  }

  if (request.action === "getMediaUrls") {
    const postId = request?.payload?.postId;
    const mediaUrls = postId ? tweetMediaCache.get(postId) || [] : [];
    sendResponse({ mediaUrls });
    return true;
  }
});
