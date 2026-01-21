// const API_URL = "http://localhost:6767";
const API_URL = "https://staging-api.isthisragebait.com";
const BE_API_KEY = "analyze-dev";
const AUTH_STORAGE_KEY = "authSession";
const ENABLED_STORAGE_KEY = "enabled";

function getAuthSession() {
  return new Promise((resolve) => {
    chrome.storage.local.get([AUTH_STORAGE_KEY], (result) => {
      resolve(result[AUTH_STORAGE_KEY] || null);
    });
  });
}

function getExtensionEnabled() {
  return new Promise((resolve) => {
    chrome.storage.local.get([ENABLED_STORAGE_KEY], (result) => {
      resolve(result[ENABLED_STORAGE_KEY] !== false);
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
        (key) => ![AUTH_STORAGE_KEY, "enabled"].includes(key),
      );
      chrome.storage.local.remove(keysToRemove, () =>
        sendResponse({ success: true }),
      );
    });
    return true;
  }

  if (request.action === "analyzePost") {
    (async () => {
      try {
        const enabled = await getExtensionEnabled();
        if (!enabled) {
          sendResponse({ error: "Extension disabled." });
          return;
        }

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
            `API ${response.status}: ${text || "Request failed"}`,
          );
        }

        const data = await response.json();
        // Expecting { rating: number } from your backend
        sendResponse({
          rageBaitScore: data?.rageBaitScore ?? 0,
          analysis: data?.analysis ?? "",
          accuracyScore: data?.accuracyScore ?? "Low",
          aiLevel: data?.aiLevel ?? 1,
        });
      } catch (err) {
        sendResponse({ error: String(err?.message || err) });
      }
    })();

    return true; // keep channel open for async
  }
});
