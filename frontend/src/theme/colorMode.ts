import { useSyncExternalStore } from 'react';

/** Theme preference (decision #83): light, dark or the device's setting. */
export type ColorModePreference = 'light' | 'dark' | 'system';
export const COLOR_MODE_PREFERENCES: ColorModePreference[] = ['system', 'light', 'dark'];

const STORAGE_KEY = 'gt.theme';
const DEFAULT_PREFERENCE: ColorModePreference = 'system';

function isPreference(value: unknown): value is ColorModePreference {
  return COLOR_MODE_PREFERENCES.includes(value as ColorModePreference);
}

function readStored(): ColorModePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isPreference(stored) ? stored : DEFAULT_PREFERENCE;
  } catch {
    // Storage blocked (private mode, policies): fall back to the default.
    return DEFAULT_PREFERENCE;
  }
}

let current: ColorModePreference = readStored();
const listeners = new Set<() => void>();

/** Changes the theme preference and remembers it in this browser. */
export function setColorModePreference(preference: ColorModePreference): void {
  if (preference === current) {
    return;
  }
  current = preference;
  try {
    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Not persisted, but the change still applies to this visit.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useColorModePreference(): ColorModePreference {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );
}
