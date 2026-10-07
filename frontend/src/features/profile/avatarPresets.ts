/**
 * Built-in avatars: original illustrations inspired by classic gaming archetypes
 * (no copyrighted characters). Ids match the backend's AVATAR_PRESETS.
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

export function isAvatarPreset(value: string): value is AvatarPreset {
  return (AVATAR_PRESETS as readonly string[]).includes(value);
}

/** Custom avatar limits (same as the backend). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
