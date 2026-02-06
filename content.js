// content.js
import { FIELD_SYNONYMS, scoreField, setValue, closestLabelText, isVisible, normalizePhoneZA } from "./utils.js";

async function getActiveProfile() {
  const stored = await chrome.storage.sync.get(["profiles", "activeProfile", "encrypted", "payload", "autoFill"]);
  let profiles = stored.profiles || {};
  let active = stored.activeProfile;

  if (stored.encrypted && stored.payload) {
    // See if popup already decrypted for this session
    const session = await chrome.storage.session.get(["decryptedProfiles", "decryptedActive"]);
    if (session.decryptedProfiles) {
      profiles = session.decryptedProfiles;
      active = session.decryptedActive;
    } else {
      // Locked; skip filling
      return { profile: null, autoFill: stored.autoFill };
    }
  }

  const profile = profiles[active] || null;
  return { profile, autoFill: stored.autoFill };
}

function buildFieldMap(profile) {
  // Prefer fullName if present
  const fullName = profile.fullName?.trim();
  const map = {
    firstName: profile.firstName || (fullName ? fullName.split(/\s+/)[0] : ""),
    lastName: profile.lastName || (fullName ? fullName.split(/\s+/).slice(1).join(" ") : ""),
    fullName: fullName || "",
    email: profile.email || "",
    phone: normalizePhoneZA(profile.phone || ""),
    idNumberZA: profile.idNumberZA || "",
    dob: profile.dob || "",
    nationality: profile.nationality || "",
    address1: profile.address1 || "",
    address2: profile.address2 || "",
    city: profile.city || "",
    province: profile.province || "",
    postalCode: profile.postalCode || "",
    country: profile.country || "South Africa",
    linkedin: profile.linkedin || "",
    github: profile.github || "",
    website: profile.website || "",
    summary: profile.summary || "",
    school: profile.school || "",
    degree: profile.degree || "",
    experience: profile.experience || "",
    coverLetter: profile.coverLetter || ""
  };
  return map;
}

function getAllInputs() {
  const selector = `input:not([type=hidden]):not([disabled]),
                    textarea:not([disabled]),
                    select:not([disabled])`;
  return Array.from(document.querySelectorAll(selector)).filter(isVisible);
}

function pickBestMatches(inputs, fieldMap) {
  const assignments = []; // { el, fieldKey, score }
  for (const [fieldKey, value] of Object.entries(fieldMap)) {
    if (!value) continue;
    let best = { el: null, score: -Infinity };
    for (const el of inputs) {
      const s = scoreField(fieldKey, el);
      if (s > best.score) best = { el, score: s };
    }
    if (best.el && best.score >= 7) {
      assignments.push({ ...best, fieldKey });
    }
  }
  return assignments;
}

function fill(assignments, fieldMap) {
  for (const { el, fieldKey } of assignments) {
    const val = fieldMap[fieldKey];
    if (!val) continue;
    // Special-case: if a form wants "Full Name" in a single input
    if (fieldKey === "firstName" || fieldKey === "lastName") {
      // If the best element looks like a full name field, use fullName
      const label = (el.placeholder || el.name || el.id || closestLabelText(el) || "").toLowerCase();
      if (/full\s*name|name$/.test(label) && fieldMap.fullName) {
        setValue(el, fieldMap.fullName);
        continue;
      }
    }
    setValue(el, val);
  }
}

async function autofillNow() {
  const { profile } = await getActiveProfile();
  if (!profile) return;
  const fieldMap = buildFieldMap(profile);
  const inputs = getAllInputs();

  // Avoid file inputs (cannot set programmatically)
  const filtered = inputs.filter(el => el.type !== "file");

  const assignments = pickBestMatches(filtered, fieldMap);
  fill(assignments, fieldMap);

  // Visual hint for file inputs (resume uploads)
  highlightFileInputs();
}

function highlightFileInputs() {
  const files = Array.from(document.querySelectorAll('input[type="file"]'));
  files.forEach(f => {
    if (!isVisible(f)) return;
    f.style.outline = "2px dashed #3b82f6";
    f.title = "Attach your resume/CV here (cannot auto-fill for security reasons).";
  });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "FILL_NOW") autofillNow();
});

(async function maybeAutoFill() {
  const { autoFill, profile } = await getActiveProfile();
  if (autoFill && profile) {
    // Give SPA frameworks a moment to render
    setTimeout(autofillNow, 1200);
  }
})();
