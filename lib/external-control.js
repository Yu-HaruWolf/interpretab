/**
 * Helpers for controlling Interpretab from a local web app via
 * `externally_connectable`.
 *
 * `manifest.json` can only declare host-level match patterns for
 * `externally_connectable` (ports cannot be listed there), so the user's
 * port restriction and on/off switch live in settings and are enforced here
 * against `sender.origin`.
 */

import { LIVE_KEYS } from "./live-session.js";

const LIVE_KEY_SET = new Set(LIVE_KEYS);

/** Setting keys a permitted local web app may read (never includes `apiKey`). */
export const EXTERNAL_READABLE_KEYS = [
  "tabEnabled",
  "tabTarget",
  "tabCaptions",
  "micEnabled",
  "micMode",
  "micSource",
  "micTarget",
  "micCaptions",
  "micMuted",
  "soundMuted",
  "micInput",
  "duckLevel",
  "obsEnabled",
  "simulInstruction",
];

/** Setting keys a permitted local web app may update. */
export const EXTERNAL_WRITABLE_KEYS = new Set(EXTERNAL_READABLE_KEYS);

/**
 * Parse a comma/space-separated list of TCP port numbers.
 *
 * Returns `null` when the input is blank, meaning "any port on localhost /
 * 127.0.0.1". Non-blank input with no valid ports returns an empty `Set`,
 * which rejects every origin.
 */
export function parseAllowedPorts(raw) {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return null;
  const ports = new Set();
  for (const token of text.split(/[\s,;]+/)) {
    if (!/^\d+$/.test(token)) continue;
    const n = Number(token);
    if (n >= 1 && n <= 65535) ports.add(String(n));
  }
  return ports;
}

/**
 * Check whether `origin` is allowed to control the extension under `settings`.
 */
export function isExternalOriginAllowed(origin, settings) {
  if (!settings?.externalControlEnabled || typeof origin !== "string" || !origin) return false;
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== "http:") return false;
  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return false;
  const allowedPorts = parseAllowedPorts(settings.externalControlPorts);
  if (allowedPorts === null) return true;
  const port = url.port || "80";
  return allowedPorts.has(port);
}

/**
 * Filter an external settings patch to writable keys and report whether any
 * changed key requires restarting an active session.
 */
export function filterExternalPatch(patch) {
  const cleanPatch = {};
  let needsRestart = false;
  if (!patch || typeof patch !== "object") return { cleanPatch, needsRestart };
  for (const [key, value] of Object.entries(patch)) {
    if (!EXTERNAL_WRITABLE_KEYS.has(key)) continue;
    cleanPatch[key] = value;
    if (!LIVE_KEY_SET.has(key)) needsRestart = true;
  }
  return { cleanPatch, needsRestart };
}

/**
 * Return the subset of `settings` safe to expose to an external web app.
 */
export function publicExternalSettings(settings = {}) {
  const out = {};
  for (const key of EXTERNAL_READABLE_KEYS) {
    if (key in settings) out[key] = settings[key];
  }
  return out;
}
