const API_URL = "http://localhost:6767";
const BE_API_KEY = "analyze-dev";

chrome.runtime.onInstalled.addListener(() => {
  console.log("Twitter Post Rater extension installed");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "clearCache") {
    chrome.storage.local.clear(() => sendResponse({ success: true }));
    return true;
  }

  if (request.action === "analyzePost") {
    (async () => {
      try {
        const response = await fetch(`${API_URL}/analyze`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": BE_API_KEY,
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
});
