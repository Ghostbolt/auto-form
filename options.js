// options.js
import { encryptJSON, decryptJSON } from "./utils.js";

const FIELDS = [
  "firstName","lastName","fullName","email","phone","idNumberZA","dob","nationality",
  "address1","address2","city","province","postalCode","country",
  "linkedin","github","website","summary","school","degree","experience","coverLetter"
];

let state = {
  profiles: {},         // { [name]: { ...fields } }
  activeProfile: null,  // profile name
  encrypted: false,
  payload: null         // if encrypted, holds ciphertext
};

const els = Object.fromEntries(FIELDS.map(k => [k, document.getElementById(k)]));
const profileSelect = document.getElementById("profileSelect");
const newProfileBtn = document.getElementById("newProfileBtn");
const deleteProfileBtn = document.getElementById("deleteProfileBtn");
const saveBtn = document.getElementById("saveBtn");
const exportBtn = document.getElementById("exportBtn");
const importFile = document.getElementById("importFile");
const encryptionPasswordEl = document.getElementById("encryptionPassword");

init();

async function init() {
  const stored = await chrome.storage.sync.get(["profiles", "activeProfile", "encrypted", "payload"]);
  state.profiles = stored.profiles || { "Personal": {} };
  state.activeProfile = stored.activeProfile || "Personal";
  state.encrypted = stored.encrypted || false;
  state.payload = stored.payload || null;

  refreshProfileList();
  loadActiveProfile();
}

function refreshProfileList() {
  profileSelect.innerHTML = "";
  Object.keys(state.profiles).forEach(name => {
    const o = document.createElement("option");
    o.value = name; o.textContent = name;
    if (name === state.activeProfile) o.selected = true;
    profileSelect.appendChild(o);
  });
}

function loadActiveProfile() {
  const data = state.profiles[state.activeProfile] || {};
  FIELDS.forEach(k => {
    els[k].value = data[k] || "";
  });
}

profileSelect.addEventListener("change", () => {
  state.activeProfile = profileSelect.value;
  loadActiveProfile();
  chrome.storage.sync.set({ activeProfile: state.activeProfile });
});

newProfileBtn.addEventListener("click", async () => {
  const name = prompt("New profile name?");
  if (!name) return;
  if (state.profiles[name]) return alert("Profile already exists.");
  state.profiles[name] = {};
  state.activeProfile = name;
  await chrome.storage.sync.set({ profiles: state.profiles, activeProfile: state.activeProfile });
  refreshProfileList();
  loadActiveProfile();
});

deleteProfileBtn.addEventListener("click", async () => {
  if (!confirm(`Delete profile "${state.activeProfile}"?`)) return;
  delete state.profiles[state.activeProfile];
  const first = Object.keys(state.profiles)[0] || "Personal";
  state.profiles[first] = state.profiles[first] || {};
  state.activeProfile = first;
  await chrome.storage.sync.set({ profiles: state.profiles, activeProfile: state.activeProfile });
  refreshProfileList();
  loadActiveProfile();
});

saveBtn.addEventListener("click", async () => {
  const data = {};
  FIELDS.forEach(k => data[k] = els[k].value.trim());
  // Normalizations
  data.phone = data.phone ? data.phone : "";
  state.profiles[state.activeProfile] = data;

  const password = encryptionPasswordEl.value.trim();
  if (password) {
    const payload = await encryptJSON({ profiles: state.profiles, activeProfile: state.activeProfile }, password);
    await chrome.storage.sync.set({ encrypted: true, payload, profiles: {}, activeProfile: null });
    alert("Saved with encryption.");
  } else {
    await chrome.storage.sync.set({ profiles: state.profiles, activeProfile: state.activeProfile, encrypted: false, payload: null });
    alert("Saved.");
  }
});

exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ profiles: state.profiles, activeProfile: state.activeProfile }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "swiftfill-profiles.json"; a.click();
  URL.revokeObjectURL(url);
});

importFile.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  try {
    const obj = JSON.parse(text);
    if (!obj.profiles) throw new Error("Invalid file");
    state.profiles = obj.profiles;
    state.activeProfile = obj.activeProfile || Object.keys(state.profiles)[0] || "Personal";
    await chrome.storage.sync.set({ profiles: state.profiles, activeProfile: state.activeProfile, encrypted: false, payload: null });
    refreshProfileList();
    loadActiveProfile();
    alert("Imported.");
  } catch (err) {
    alert("Import failed: " + err.message);
  }
});
