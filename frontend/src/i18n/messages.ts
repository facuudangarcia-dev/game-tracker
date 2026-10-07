import { en } from './en';
import { es } from './es';

/** Literal types of the reference locale widened (string, number, functions...). */
type Widen<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends (...args: infer A) => infer R
      ? (...args: A) => Widen<R>
      : T extends readonly (infer U)[]
        ? readonly Widen<U>[]
        : T extends object
          ? { readonly [K in keyof T]: Widen<T[K]> }
          : T;

/** Shape every locale must have: the Spanish texts' structure. */
export type Messages = Widen<typeof es>;

export const LOCALES = ['es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const dictionaries: Record<Locale, Messages> = { es, en };

function clone<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item: unknown) => clone(item)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, clone(item as unknown)]),
    ) as T;
  }
  return value;
}

/** Copies `source` into `target` in place, keeping every nested object's identity. */
function assignDeep(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(source)) {
    const current = target[key];
    if (value && typeof value === 'object' && current && typeof current === 'object') {
      assignDeep(current as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      target[key] = value;
    }
  }
}

/**
 * User-facing texts of the current locale (docs/decisions.md #16, #54). Components
 * read it directly (`messages.home.title`, or `const t = messages.home` at module
 * level): switching the locale updates this object in place and re-renders the
 * app, so no component needs to know about locales.
 */
export const messages: Messages = clone(es);

/** Switches `messages` to `locale`. Use `setLocale` (locale.ts) from the UI. */
export function applyMessages(locale: Locale): void {
  assignDeep(messages, dictionaries[locale]);
}
