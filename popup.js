// popup.js
const profileSelect = document.getElementById("profileSelect");
const autoFillToggle = document.getElementById("autoFillToggle");
const urlInput = document.getElementById("urlInput");
const openFillBtn = document.getElementById("openFillBtn");
const fillNowBtn = document.getElementById("fillNowBtn");
const optionsLink = document.getElementById("optionsLink");
const statusEl = document.getElementById("status");

init();

async function init() {
  const stored = await chrome.storage.sync.get(["profiles", "activeProfile", "encrypted", "payload", "autoFill"]);
  let profiles = stored.profiles || {};
  let activeProfile = stored.activeProfile || Object.keys(profiles)[0] || null;

  // If encrypted, prompt for password (once per popup open)
  if (stored.encrypted && stored.payload) {
    const pwd = prompt("Enter encryption password to unlock profiles:");
    if (!pwd) return showStatus("Locked (no password). Open Options to re-save without encryption.");
    try {
      const { decryptJSON } = await import("./utils.js");
      const obj = await decryptJSON(stored.payload, pwd);
      profiles = obj.profiles;
      activeProfile = obj.activeProfile;
      await chrome.storage.session.set({ decryptedProfiles: profiles, decryptedActive: activeProfile });
    } catch {
      return showStatus("Incorrect password. Data remains locked.");
    }
  } else {
    await chrome.storage.session.set({ decryptedProfiles: null, decryptedActive: null });
  }

  // Populate profiles
  profileSelect.innerHTML = "";
  Object.keys(profiles).forEach(name => {
    const o = document.createElement("option");
    o.value = name; o.textContent = name;
    if (name === activeProfile) o.selected = true;
    profileSelect.appendChild(o);
  });

  autoFillToggle.checked = !!stored.autoFill;
}

profileSelect.addEventListener("change", async () => {
  await chrome.storage.sync.set({ activeProfile: profileSelect.value });
});

autoFillToggle.addEventListener("change", async () => {
  await chrome.storage.sync.set({ autoFill: autoFillToggle.checked });
});

openFillBtn.addEventListener("click", async () => {
  const url = urlInput.value.trim();
  if (!/^https?:\/\//i.test(url)) return showStatus("Please enter a valid http(s) URL.");
  const tab = await chrome.tabs.create({ url, active: true });
  chrome.runtime.sendMessage({ type: "RUN_FILL_ON_TAB", tabId: tab.id });
  showStatus("Opening and filling...");
});

fillNowBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "FILL_NOW" });
});

optionsLink.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

function showStatus(msg) {
  statusEl.textContent = msg;
}
