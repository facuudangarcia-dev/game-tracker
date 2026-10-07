/**
 * Built-in avatars (original illustrations shipped with the frontend). Only the
 * id is stored; the frontend owns the artwork (docs/decisions.md #56).
 */
export const AVATAR_PRESETS = [
  'knight',
  'ninja',
  'mage',
  'spartan',
  'samurai',
  'astronaut',
  'robot',
  'ghost',
  'racer',
  'alien',
  'archer',
  'gamer',
] as const;

export type AvatarPreset = (typeof AVATAR_PRESETS)[number];

/** Custom avatar limits (docs/decisions.md #56). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
