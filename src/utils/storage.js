import { SNAPSHOTS_KEY, STORAGE_KEY } from "./constants.js";

export function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const state = raw ? JSON.parse(raw) : null;
    if (state?.workspaceColors) {
      state.workspaceColors = state.workspaceColors.map((color) => ({
        ...color,
        enabled: color.enabled !== false,
      }));
    }
    if (!state?.swatchViews && state?.swatchView) {
      state.swatchViews = {
        workspace: state.swatchView,
      };
    }
    return state;
  } catch {
    return null;
  }
}

export function loadSnapshots() {
  try {
    const snapshots = JSON.parse(localStorage.getItem(SNAPSHOTS_KEY) ?? "[]");
    return Array.isArray(snapshots) ? snapshots : [];
  } catch {
    return [];
  }
}

export function snapshotHash() {
  const bytes = new Uint8Array(2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function friendlyTime(value) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (elapsed < minute) return "just now";
  if (elapsed < hour) {
    const count = Math.floor(elapsed / minute);
    return `${count} ${count === 1 ? "minute" : "minutes"} ago`;
  }
  if (elapsed < day) {
    const count = Math.floor(elapsed / hour);
    return `${count} ${count === 1 ? "hour" : "hours"} ago`;
  }
  const count = Math.floor(elapsed / day);
  return `${count} ${count === 1 ? "day" : "days"} ago`;
}
