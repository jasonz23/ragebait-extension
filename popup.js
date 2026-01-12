// const API_URL = "http://localhost:6767";
const API_URL = "https://staging-api.isthisragebait.com";
const AUTH_STORAGE_KEY = "authSession";

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

let stats = {
  postsAnalyzed: 0,
  averageMeter: 0,
  postsRemaining: 0,
};

let authSession = null;

function storageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

function storageSet(payload) {
  return new Promise((resolve) => {
    chrome.storage.local.set(payload, resolve);
  });
}

function storageRemove(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, resolve);
  });
}

function normalizeAuthResponse(data, fallbackEmail) {
  const accessToken =
    data?.jwtToken || data?.accessToken || data?.token || data?.jwt;
  const refreshToken =
    data?.refreshToken || data?.refresh || data?.refresh_token;
  const user = data?.user ||
    data?.userData ||
    data?.profile || {
      email: fallbackEmail,
    };

  if (!accessToken || !refreshToken) {
    throw new Error("Missing authentication tokens.");
  }

  return { accessToken, refreshToken, user };
}

async function getAuthSession() {
  const result = await storageGet([AUTH_STORAGE_KEY]);
  return result[AUTH_STORAGE_KEY] || null;
}

async function setAuthSession(session) {
  authSession = session;
  await storageSet({ [AUTH_STORAGE_KEY]: session });
}

async function clearAuthSession() {
  authSession = null;
  await storageRemove([AUTH_STORAGE_KEY]);
}

function showStatus(message, duration = 3000) {
  const statusEl = document.getElementById("statusMsg");
  statusEl.textContent = message;
  statusEl.classList.add("show");

  if (duration) {
    setTimeout(() => {
      statusEl.classList.remove("show");
    }, duration);
  }
}

function updateStatsDisplay() {
  document.getElementById("postsAnalyzed").textContent =
    stats.postsAnalyzed ?? 0;
  document.getElementById("avgMeter").textContent = stats?.averageMeter
    ? scoreToTheme(Number(stats?.averageMeter) ?? 0)?.label
    : "—";
  document.getElementById("postsRemaining").textContent =
    stats.postsRemaining ?? 0;
}

function updateAuthUI(session) {
  const authForms = document.getElementById("authForms");
  const signedIn = document.getElementById("signedIn");
  const statsCard = document.getElementById("statsCard");
  const userLabel = document.getElementById("userLabel");

  if (session) {
    authForms.classList.add("hidden");
    signedIn.classList.remove("hidden");
    statsCard.classList.remove("hidden");

    const displayName =
      session.user?.username || session.user?.name || session.user?.email || "";
    userLabel.textContent = displayName ? `@${displayName}` : "Signed in";
  } else {
    authForms.classList.remove("hidden");
    signedIn.classList.add("hidden");
    statsCard.classList.add("hidden");
    userLabel.textContent = "—";
  }
}

async function refreshSession(refreshToken) {
  try {
    authSession = await getAuthSession();

    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authSession?.accessToken}`,
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      throw new Error("Refresh failed");
    }

    const data = await response.json();
    const session = normalizeAuthResponse(data, authSession?.user?.email);
    await setAuthSession(session);
    await loadStats();
    return session;
  } catch (error) {
    await clearAuthSession();
    updateAuthUI(null);
    showStatus("Session expired. Please log in again.");
    return null;
  }
}

async function fetchWithAuth(url, options = {}) {
  authSession = await getAuthSession();
  if (!authSession?.accessToken) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authSession.accessToken}`,
      ...(options.headers || {}),
    },
  });

  if (response.status === 401 && authSession?.refreshToken) {
    const refreshed = await refreshSession(authSession.refreshToken);
    if (!refreshed) {
      throw new Error("Session expired");
    }

    return fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${refreshed.accessToken}`,
        ...(options.headers || {}),
      },
    });
  }

  return response;
}

async function loadStats() {
  if (!authSession) {
    stats = { postsAnalyzed: 0, averageMeter: 0, postsRemaining: 0 };
    updateStatsDisplay();
    return;
  }

  try {
    const response = await fetchWithAuth(`${API_URL}/user/me/stats`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error("Unable to load stats");
    }

    const data = await response.json();
    stats = {
      postsAnalyzed: data?.postsAnalyzed ?? data?.postsAnalyzedCount ?? 0,
      averageMeter: data?.averageMeter ?? data?.avgMeter ?? 0,
      postsRemaining: data?.dailyPostsRemaining ?? data?.remainingPosts ?? 0,
    };
    updateStatsDisplay();
  } catch (error) {
    showStatus("Unable to load stats.");
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorMessage = await response.text();
      throw new Error(errorMessage || "Login failed");
    }

    const data = await response.json();
    const session = normalizeAuthResponse(data, email);
    await setAuthSession(session);
    updateAuthUI(session);
    await loadStats();
    showStatus("Welcome back!");
  } catch (error) {
    showStatus(error.message || "Login failed");
  }
}

async function handleSignup(event) {
  event.preventDefault();
  const username = document.getElementById("signupUsername").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value.trim();

  try {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });

    if (!response.ok) {
      const errorMessage = await response.text();
      throw new Error(errorMessage || "Signup failed");
    }

    const data = await response.json();
    const session = normalizeAuthResponse(data, email);
    await setAuthSession(session);
    updateAuthUI(session);
    await loadStats();
    showStatus("Account created!");
  } catch (error) {
    showStatus(error.message || "Signup failed");
  }
}

async function handleLogout() {
  await clearAuthSession();
  updateAuthUI(null);
  stats = { postsAnalyzed: 0, averageMeter: 0, postsRemaining: 0 };
  updateStatsDisplay();
  showStatus("Logged out.");
}

function setActiveTab(tabName) {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });
  document
    .getElementById("loginForm")
    .classList.toggle("hidden", tabName !== "login");
  document
    .getElementById("signupForm")
    .classList.toggle("hidden", tabName !== "signup");
}

async function bootstrapAuth() {
  authSession = await getAuthSession();
  if (authSession?.refreshToken) {
    const refreshed = await refreshSession(authSession.refreshToken);
    authSession = refreshed || null;
  }

  updateAuthUI(authSession);
  await loadStats();
}

// Enable/disable toggle
const enableToggle = document.getElementById("enableToggle");
enableToggle.addEventListener("change", (e) => {
  const enabled = e.target.checked;
  chrome.storage.local.set({ enabled }, () => {
    showStatus(enabled ? "Extension enabled" : "Extension disabled");

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

chrome.storage.local.get(["enabled"], (result) => {
  const enabled = result.enabled !== false;
  enableToggle.checked = enabled;
});

// Clear cache button
const clearBtn = document.getElementById("clearBtn");
clearBtn.addEventListener("click", () => {
  if (confirm("Clear all cached ratings?")) {
    chrome.storage.local.get(null, (items) => {
      const keysToRemove = Object.keys(items).filter(
        (key) => ![AUTH_STORAGE_KEY, "enabled"].includes(key)
      );

      chrome.storage.local.remove(keysToRemove, () => {
        showStatus("Cache cleared!");
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "clearCache" });
          }
        });
      });
    });
  }
});

// Auth forms
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const logoutBtn = document.getElementById("logoutBtn");

loginForm.addEventListener("submit", handleLogin);
signupForm.addEventListener("submit", handleSignup);
logoutBtn.addEventListener("click", handleLogout);

document.querySelectorAll(".tab-button").forEach((button) => {
  button.addEventListener("click", () => setActiveTab(button.dataset.tab));
});

// Initialize
setActiveTab("login");
bootstrapAuth();
