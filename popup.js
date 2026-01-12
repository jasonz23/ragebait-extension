let stats = {
  postsRated: 0,
  totalRating: 0,
  cacheSize: 0,
};

// Load stats from storage
function loadStats() {
  chrome.storage.local.get(["stats"], (result) => {
    if (result.stats) {
      stats = result.stats;
      updateDisplay();
    }
  });

  // Get cache size
  chrome.storage.local.get(null, (items) => {
    stats.cacheSize = Object.keys(items).length - 1; // -1 for stats object
    updateDisplay();
  });
}

// Update display
function updateDisplay() {
  document.getElementById("postsRated").textContent = stats.postsRated;

  const avgRating =
    stats.postsRated > 0
      ? (stats.totalRating / stats.postsRated).toFixed(1)
      : "-";
  document.getElementById("avgRating").textContent = avgRating;

  document.getElementById("cacheSize").textContent = stats.cacheSize;
}

// Show status message
function showStatus(message, duration = 3000) {
  const statusEl = document.getElementById("statusMsg");
  statusEl.textContent = message;
  statusEl.classList.add("show");

  setTimeout(() => {
    statusEl.classList.remove("show");
  }, duration);
}

// Enable/disable toggle
document.getElementById("enableToggle").addEventListener("change", (e) => {
  const enabled = e.target.checked;
  chrome.storage.local.set({ enabled }, () => {
    showStatus(enabled ? "Extension enabled" : "Extension disabled");

    // Notify content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "toggleExtension",
          enabled,
        });
      }
    });
  });
});

// Load enabled state
chrome.storage.local.get(["enabled"], (result) => {
  const enabled = result.enabled !== false; // Default to true
  document.getElementById("enableToggle").checked = enabled;
});

// Refresh ratings button
document.getElementById("refreshBtn").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "refreshRatings" });
      showStatus("Refreshing ratings...");
    }
  });
});

// Settings button
document.getElementById("settingsBtn").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

// Clear cache button
document.getElementById("clearBtn").addEventListener("click", () => {
  if (confirm("Clear all cached ratings?")) {
    chrome.storage.local.clear(() => {
      stats = { postsRated: 0, totalRating: 0, cacheSize: 0 };
      updateDisplay();
      showStatus("Cache cleared!");

      // Notify content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: "clearCache" });
        }
      });
    });
  }
});

// Initialize
loadStats();
