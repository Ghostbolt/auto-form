// utils.js

// Synonym dictionary with weights for scoring.
// Add more as you discover variations (Workday/Greenhouse/Lever, etc.)
export const FIELD_SYNONYMS = {
  firstName: [/first\s*name/i, /\bfname\b/i, /given\s*name/i, /forename/i],
  lastName: [/last\s*name/i, /\blname\b/i, /surname/i, /family\s*name/i],
  fullName: [/full\s*name/i, /name$/i],
  email: [/e-?mail/i, /\bemail\b/i],
  phone: [/phone/i, /mobile/i, /cell/i, /\btel\b/i, /telephone/i, /contact\s*number/i],
  idNumberZA: [/id\s*(number|no)/i, /\bsa\s*id\b/i, /\bza\s*id\b/i, /\bnational\s*id\b/i],
  address1: [/address(\s*1)?/i, /street/i, /line\s*1/i],
  address2: [/address\s*2/i, /line\s*2/i, /suburb/i],
  city: [/city/i, /town/i],
  province: [/province/i, /state/i, /region/i],
  postalCode: [/postal(\s*code)?/i, /zip/i],
  country: [/country/i],
  linkedin: [/linked\s*in/i],
  github: [/git\s*hub/i],
  website: [/website/i, /portfolio/i, /personal\s*site/i],
  education: [/education/i, /qualification/i],
  degree: [/degree/i, /qualification/i, /major/i],
  school: [/school/i, /university/i, /college/i, /institution/i],
  experience: [/experience/i, /work\s*history/i],
  coverLetter: [/cover\s*letter/i],
  summary: [/summary/i, /about\s*you/i, /bio/i],
  dob: [/date\s*of\s*birth/i, /\bdob\b/i],
  nationality: [/nationality/i],
  // Common job-app platforms sometimes use generic/opaque names—labels still help.
};

export function normalizePhoneZA(str) {
  if (!str) return "";
  // Normalize South African numbers to +27xxxxxxxxx (remove leading 0)
  const digits = str.replace(/\D+/g, "");
  if (digits.startsWith("27")) return "+" + digits;
  if (digits.startsWith("0") && digits.length >= 10) return "+27" + digits.slice(1);
  if (digits.length === 9) return "+27" + digits;
  return "+" + digits; // fallback
}

export function scoreField(fieldKey, el) {
  // Score an element by checking id, name, placeholder, aria-label, associated <label>, and type
  const patterns = FIELD_SYNONYMS[fieldKey] || [];
  const haystack = [
    el.id, el.name, el.placeholder,
    el.getAttribute("aria-label"),
    closestLabelText(el)
  ].filter(Boolean).join(" ").toLowerCase();

  let score = 0;
  for (const re of patterns) {
    if (re.test(haystack)) score += 10;
  }

  // Type hints
  const type = (el.type || "").toLowerCase();
  if (fieldKey === "email" && type === "email") score += 5;
  if (fieldKey === "phone" && (type === "tel" || type === "number")) score += 3;
  if (fieldKey === "postalCode" && type === "number") score += 1;

  // Penalize hidden/disabled
  if (el.disabled || el.type === "hidden" || !isVisible(el)) score -= 20;

  return score;
}

export function closestLabelText(el) {
  // Find <label for="..."> or a wrapping label
  const id = el.id && el.id.trim();
  if (id) {
    const explicit = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (explicit) return explicit.textContent || "";
  }
  const parentLabel = el.closest("label");
  return parentLabel ? parentLabel.textContent || "" : "";
}

export function isVisible(el) {
  const rect = el.getBoundingClientRect();
  const styles = window.getComputedStyle(el);
  return rect.width > 0 && rect.height > 0 && styles.visibility !== "hidden" && styles.display !== "none";
}

export function setValue(el, value) {
  if (el.tagName === "SELECT") {
    // Try exact match or case-insensitive text match
    const lower = String(value).toLowerCase();
    let matched = false;
    for (const opt of el.options) {
      if (opt.value.toLowerCase() === lower || opt.text.toLowerCase() === lower) {
        el.value = opt.value;
        matched = true;
        break;
      }
    }
    if (!matched && el.options.length) {
      // Fallback: try contains
      for (const opt of el.options) {
        if (opt.text.toLowerCase().includes(lower)) {
          el.value = opt.value;
          matched = true;
          break;
        }
      }
    }
  } else if (el.type === "checkbox" || el.type === "radio") {
    el.checked = Boolean(value) === true;
  } else if (el.type === "date") {
    // Expect yyyy-mm-dd
    el.value = String(value);
  } else {
    el.value = String(value);
  }

  // Fire events so frameworks (React/Vue/Angular) pick up changes
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

export async function encryptJSON(data, password) {
  // Optional: simple AES-GCM client-side encryption using Web Crypto
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(data)));
  return {
    salt: Array.from(salt),
    iv: Array.from(iv),
    cipher: Array.from(new Uint8Array(cipher))
  };
}

export async function decryptJSON(payload, password) {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const { salt, iv, cipher } = payload;
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: new Uint8Array(salt), iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(iv) }, key, new Uint8Array(cipher));
  return JSON.parse(dec.decode(plain));
}
