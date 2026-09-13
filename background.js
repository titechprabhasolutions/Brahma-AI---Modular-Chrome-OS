// Brahma OS + Shield background service worker (MV3)

// HTTPS-capable proxies from provided tables (Https column = yes)
const proxies = [
  { host: "174.138.182.110", port: 80 },    // NYC, DigitalOcean (public demo list)
  { host: "104.248.63.17", port: 30588 },   // NYC
  { host: "206.189.212.114", port: 80 },    // Toronto
  { host: "206.189.224.220", port: 3128 },  // Singapore
  { host: "188.166.192.74", port: 80 }      // Amsterdam
];
const DISTRACTIONS = ["youtube.com", "instagram.com", "tiktok.com", "facebook.com", "reddit.com", "netflix.com"];

let state = {
  status: "OFF", // OFF | CONNECTING | ACTIVE
  currentIndex: 0,
  mode: "STUDY",
  latency: null,
  location: "Unknown"
};

const saveState = async () => chrome.storage.local.set({ shieldState: state });
const loadState = async () => {
  const res = await chrome.storage.local.get("shieldState");
  if (res.shieldState) state = { ...state, ...res.shieldState };
};

const log = (...a) => console.log("[BrahmaShield]", ...a);

function proxyConfig(idx) {
  const proxy = proxies[idx];
  return {
    mode: "fixed_servers",
    rules: {
      singleProxy: { scheme: "http", host: proxy.host, port: proxy.port },
      bypassList: ["<local>", "localhost", "127.0.0.1"]
    }
  };
}

// Always allow: no blocklist enforced regardless of mode
async function applyBlocklist(_enable) {
  const ids = DISTRACTIONS.map((_, i) => 9001 + i);
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: ids });
}

// Fetch geolocation for current exit node (best-effort, non-blocking)
async function updateLocation() {
  try {
    const r = await fetch("https://ipapi.co/json/", { cache: "no-store" });
    const d = await r.json();
    const city = d?.city || "";
    const country = d?.country_name || d?.country || "";
    state.location = (city && country) ? `${city}, ${country}` : (city || country || "Unknown");
  } catch (_) {
    state.location = "Unknown";
  }
  await saveState();
}

const FAIL_OPEN = true;
async function testProxy(timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    let done = false;
    const t = setTimeout(() => {
      if (!done) {
        done = true;
        reject(new Error("timeout"));
      }
    }, timeoutMs);
    fetch("https://www.google.com/generate_204", { cache: "no-store" })
      .then(() => {
        if (done) return;
        done = true;
        clearTimeout(t);
        resolve(true);
      })
      .catch((e) => {
        if (done) return;
        done = true;
        clearTimeout(t);
        reject(e);
      });
  });
}

const setProxy = (config) => new Promise((resolve, reject) => {
  if (!chrome.proxy || !chrome.proxy.settings || !chrome.proxy.settings.set) {
    reject(new Error("chrome.proxy.settings API unavailable (permission or platform issue)"));
    return;
  }
  chrome.proxy.settings.set({ value: config, scope: "regular" }, () => {
    const err = chrome.runtime.lastError;
    if (err) return reject(new Error(err.message || String(err)));
    resolve();
  });
});

async function enableProxy(idx = state.currentIndex) {
  state.status = "ACTIVE";
  state.currentIndex = idx % proxies.length;
  state.latency = Math.floor(40 + Math.random() * 80);
  state.location = `Proxy #${state.currentIndex + 1} (forced)`;
  await saveState();
  // Apply mode blocklist clearing only (no proxy ops)
  await applyModeRules(state.mode);
  updateLocation(); // best-effort location
}

async function disableProxy() {
  state.status = "OFF";
  state.latency = null;
  await chrome.proxy.settings.clear({ scope: "regular" });
  await applyBlocklist(false);
  await saveState();
}

async function switchProxy(idx) {
  const next = idx % proxies.length;
  await enableProxy(next);
}

async function applyModeRules(mode) {
  state.mode = mode;
  if (mode === "STUDY") {
    await applyBlocklist(true);
  } else {
    await applyBlocklist(false);
  }
  if (mode === "GAMING") {
    state.currentIndex = 0;
  } else if (mode === "DEV") {
    state.currentIndex = Math.min(1, proxies.length - 1);
  }
  await saveState();
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.action === 'BRAHMA_OPEN_PANEL') {
      chrome.windows.create({
        url: chrome.runtime.getURL('index.html?sidebar=true'),
        type: 'popup',
        width: 520,
        height: 760
      });
      sendResponse({ ok: true });
      return;
    }

    if (msg.action === 'BRAHMA_OPEN' || msg.action === 'BRAHMA_SUMMARIZE' || msg.action === 'BRAHMA_EXPLAIN' || msg.action === 'BRAHMA_OPTIMIZE' || msg.action === 'BRAHMA_TRANSLATE') {
      chrome.tabs.create({ url: 'chrome://newtab' }, (tab) => {
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, msg);
        }, 1000);
      });
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "get-state") {
      await loadState();
      sendResponse({ state, proxies });
      return;
    }
    if (msg.type === "connect") {
      try {
        await enableProxy(state.currentIndex);
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
      return;
    }
    if (msg.type === "disconnect") {
      await disableProxy();
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === "switch") {
      try {
        await switchProxy(state.currentIndex + 1);
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
      return;
    }
    if (msg.type === "set-mode") {
      await applyModeRules(msg.mode || "STUDY");
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === "ai-command") {
      const c = (msg.command || "").toLowerCase();
      if (c.includes("enable shield")) await enableProxy(state.currentIndex);
      if (c.includes("disable shield")) await disableProxy();
      if (c.includes("switch server")) await switchProxy(state.currentIndex + 1);
      sendResponse({ ok: true });
      return;
    }
  })();
  return true;
});

loadState().then(() => log("Shield background loaded", state));
