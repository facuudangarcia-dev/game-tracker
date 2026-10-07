import { useSyncExternalStore } from 'react';
import { applyMessages, type Locale, LOCALES } from './messages';

const STORAGE_KEY = 'gt.locale';
const DEFAULT_LOCALE: Locale = 'es';

/** BCP 47 tags used for Intl formatting (dates, numbers). */
const INTL_LOCALES: Record<Locale, string> = { es: 'es-AR', en: 'en-US' };

function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale);
}

function readStoredLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    // Storage blocked (private mode, policies): fall back to the default.
    return DEFAULT_LOCALE;
  }
}

let current: Locale = DEFAULT_LOCALE;
const listeners = new Set<() => void>();

function apply(locale: Locale): void {
  current = locale;
  applyMessages(locale);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
}

apply(readStoredLocale());

export function getLocale(): Locale {
  return current;
}

/** Intl locale tag of the current locale, e.g. "es-AR". */
export function intlLocale(): string {
  return INTL_LOCALES[current];
}

/** Changes the interface language and remembers it in this browser. */
export function setLocale(locale: Locale): void {
  if (locale === current) {
    return;
  }
  apply(locale);
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Not persisted, but the change still applies to this visit.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Current locale; components using it re-render when it changes. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale, getLocale);
}

const dateFormats = new Map<string, Intl.DateTimeFormat>();

/** Date formatter for the current locale (cached per locale and options). */
export function dateFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${current}|${JSON.stringify(options)}`;
  let format = dateFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(intlLocale(), options);
    dateFormats.set(key, format);
  }
  return format;
}
