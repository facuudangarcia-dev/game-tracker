import type { ReactNode } from 'react';

import type { AvatarPreset } from './avatarPresets';

/** Artwork of each built-in avatar. */
interface AvatarArt {
  /** Background gradient: [inner, outer]. */
  colors: [string, string];
  figure: ReactNode;
}

const SKIN = '#f2c7a5';
const DARK = '#14161c';

const ART: Record<AvatarPreset, AvatarArt> = {
  knight: {
    colors: ['#5b7bd6', '#1b2450'],
    figure: (
      <>
        <path
          d="M50 18 C64 18 72 30 72 46 L72 72 L28 72 L28 46 C28 30 36 18 50 18 Z"
          fill="#c9d1e3"
        />
        <path
          d="M50 18 C64 18 72 30 72 46 L72 50 L28 50 L28 46 C28 30 36 18 50 18 Z"
          fill="#e4e9f3"
        />
        <rect x="31" y="47" width="38" height="5" rx="2.5" fill={DARK} />
        <rect x="48" y="52" width="4" height="18" rx="1" fill="#9aa4bc" />
        <path d="M50 18 C52 10 58 6 66 6 C60 10 56 14 54 20 Z" fill="#ff5c6c" />
        <rect x="24" y="72" width="52" height="16" rx="6" fill="#8e98b3" />
      </>
    ),
  },
  ninja: {
    colors: ['#3a3f52', '#0d0f15'],
    figure: (
      <>
        <circle cx="50" cy="48" r="24" fill="#22252f" />
        <rect x="26" y="40" width="48" height="13" rx="6" fill={SKIN} />
        <path d="M36 46 L46 44 L46 48 L37 49 Z" fill={DARK} />
        <path d="M64 46 L54 44 L54 48 L63 49 Z" fill={DARK} />
        <rect x="24" y="30" width="52" height="6" rx="3" fill="#e5484d" />
        <path d="M74 33 L90 26 L86 36 Z" fill="#e5484d" />
        <rect x="28" y="72" width="44" height="16" rx="7" fill="#22252f" />
      </>
    ),
  },
  mage: {
    colors: ['#8a5cf6', '#2a1559'],
    figure: (
      <>
        <path d="M50 6 L70 44 L30 44 Z" fill="#4f2fb3" />
        <path d="M24 44 L76 44 L72 50 L28 50 Z" fill="#3b2290" />
        <circle cx="52" cy="22" r="2.4" fill="#ffd166" />
        <circle cx="45" cy="34" r="1.8" fill="#ffd166" />
        <circle cx="50" cy="56" r="13" fill={SKIN} />
        <circle cx="45" cy="55" r="1.8" fill={DARK} />
        <circle cx="55" cy="55" r="1.8" fill={DARK} />
        <path d="M36 60 C40 82 60 82 64 60 C58 66 42 66 36 60 Z" fill="#eef0f7" />
        <rect x="30" y="76" width="40" height="14" rx="6" fill="#4f2fb3" />
      </>
    ),
  },
  spartan: {
    colors: ['#d4a24c', '#4a2a0c'],
    figure: (
      <>
        <path d="M30 26 C34 10 66 10 70 26 L56 26 L50 14 L44 26 Z" fill="#c8312f" />
        <path
          d="M28 32 C28 18 72 18 72 32 L72 66 L58 72 L58 50 L42 50 L42 72 L28 66 Z"
          fill="#c9922f"
        />
        <rect x="46" y="38" width="8" height="34" fill={DARK} />
        <rect x="36" y="38" width="28" height="7" rx="2" fill={DARK} />
        <rect x="26" y="74" width="48" height="14" rx="6" fill="#8a5a1c" />
      </>
    ),
  },
  samurai: {
    colors: ['#e5484d', '#4a0e14'],
    figure: (
      <>
        <path
          d="M22 22 C30 34 40 36 50 36 C60 36 70 34 78 22 C74 38 64 42 50 42 C36 42 26 38 22 22 Z"
          fill="#ffd166"
        />
        <path d="M30 46 C30 32 70 32 70 46 L70 50 L30 50 Z" fill="#1d1f27" />
        <circle cx="50" cy="56" r="13" fill={SKIN} />
        <path d="M42 54 L47 55" stroke={DARK} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M58 54 L53 55" stroke={DARK} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M24 46 L36 46 L34 66 L24 62 Z" fill="#7d1d24" />
        <path d="M76 46 L64 46 L66 66 L76 62 Z" fill="#7d1d24" />
        <rect x="30" y="72" width="40" height="16" rx="6" fill="#1d1f27" />
      </>
    ),
  },
  astronaut: {
    colors: ['#3fa7d6', '#0b2236'],
    figure: (
      <>
        <circle cx="50" cy="46" r="27" fill="#eef2f7" />
        <rect x="31" y="34" width="38" height="26" rx="13" fill="#1a2b45" />
        <path
          d="M37 40 C42 36 48 36 52 37"
          stroke="#7fd3ff"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="76" cy="40" r="4" fill="#ff8a3d" />
        <rect x="26" y="72" width="48" height="16" rx="7" fill="#d5dbe5" />
        <rect x="44" y="76" width="12" height="6" rx="2" fill="#ff8a3d" />
      </>
    ),
  },
  robot: {
    colors: ['#2fbf9f', '#0b3a32'],
    figure: (
      <>
        <rect x="48" y="10" width="4" height="12" fill="#9aa4bc" />
        <circle cx="50" cy="10" r="4" fill="#ff5c6c" />
        <rect x="28" y="22" width="44" height="40" rx="9" fill="#b9c3d6" />
        <rect x="34" y="32" width="32" height="14" rx="7" fill={DARK} />
        <circle cx="42" cy="39" r="3.5" fill="#5ef2c9" />
        <circle cx="58" cy="39" r="3.5" fill="#5ef2c9" />
        <rect x="40" y="51" width="20" height="4" rx="2" fill="#7c879e" />
        <rect x="22" y="36" width="6" height="12" rx="2" fill="#7c879e" />
        <rect x="72" y="36" width="6" height="12" rx="2" fill="#7c879e" />
        <rect x="30" y="66" width="40" height="22" rx="6" fill="#8e98b3" />
      </>
    ),
  },
  ghost: {
    colors: ['#ff7ac6', '#3d0f2c'],
    figure: (
      <>
        <path
          d="M26 80 L26 46 C26 30 37 20 50 20 C63 20 74 30 74 46 L74 80 L66 72 L58 80 L50 72 L42 80 L34 72 Z"
          fill="#f6f2ff"
        />
        <ellipse cx="41" cy="46" rx="6" ry="8" fill="#ffffff" />
        <ellipse cx="59" cy="46" rx="6" ry="8" fill="#ffffff" />
        <circle cx="43" cy="48" r="3.4" fill="#3b3fd8" />
        <circle cx="61" cy="48" r="3.4" fill="#3b3fd8" />
      </>
    ),
  },
  racer: {
    colors: ['#ff8a3d', '#4a1d05'],
    figure: (
      <>
        <path
          d="M26 54 C26 30 40 20 54 20 C68 20 76 32 76 48 L76 62 C76 66 72 70 68 70 L30 70 C28 70 26 66 26 62 Z"
          fill="#f4f6fa"
        />
        <path d="M44 22 C46 34 46 52 44 70 L36 70 C38 52 38 34 36 24 Z" fill="#e5484d" />
        <rect x="50" y="38" width="28" height="18" rx="8" fill="#1a2b45" />
        <path d="M56 42 L70 42" stroke="#7fd3ff" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="28" y="74" width="44" height="14" rx="6" fill="#e5484d" />
      </>
    ),
  },
  alien: {
    colors: ['#7bd84a', '#13360a'],
    figure: (
      <>
        <path
          d="M50 14 C68 14 76 28 74 44 C72 60 60 74 50 74 C40 74 28 60 26 44 C24 28 32 14 50 14 Z"
          fill="#9be36b"
        />
        <path d="M32 42 C36 36 44 38 46 46 C44 52 36 52 32 42 Z" fill={DARK} />
        <path d="M68 42 C64 36 56 38 54 46 C56 52 64 52 68 42 Z" fill={DARK} />
        <path
          d="M45 62 C48 64 52 64 55 62"
          stroke="#3c7a1f"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        <rect x="32" y="76" width="36" height="12" rx="6" fill="#5aa62f" />
      </>
    ),
  },
  archer: {
    colors: ['#3fbf6f', '#0b3319'],
    figure: (
      <>
        <path
          d="M50 14 C70 14 78 34 76 56 L70 72 L30 72 L24 56 C22 34 30 14 50 14 Z"
          fill="#2f7d47"
        />
        <circle cx="50" cy="50" r="15" fill={SKIN} />
        <path d="M34 46 C38 30 62 30 66 46 C60 40 40 40 34 46 Z" fill="#1f5a32" />
        <circle cx="45" cy="51" r="2" fill={DARK} />
        <circle cx="55" cy="51" r="2" fill={DARK} />
        <path d="M74 12 L58 34" stroke="#c9a46a" strokeWidth="3" strokeLinecap="round" />
        <path d="M74 12 L70 20 L78 16 Z" fill="#e5e7ee" />
        <rect x="28" y="74" width="44" height="14" rx="6" fill="#2f7d47" />
      </>
    ),
  },
  gamer: {
    colors: ['#7c9cff', '#1b1f4d'],
    figure: (
      <>
        <circle cx="50" cy="46" r="18" fill={SKIN} />
        <path d="M32 42 C32 24 68 24 68 42 C62 34 38 34 32 42 Z" fill="#2b2f3a" />
        <path
          d="M28 46 C28 22 72 22 72 46"
          stroke="#e5484d"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
        <rect x="24" y="42" width="9" height="16" rx="4" fill="#e5484d" />
        <rect x="67" y="42" width="9" height="16" rx="4" fill="#e5484d" />
        <circle cx="44" cy="47" r="2" fill={DARK} />
        <circle cx="56" cy="47" r="2" fill={DARK} />
        <path
          d="M45 55 C48 58 52 58 55 55"
          stroke={DARK}
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <rect x="30" y="70" width="40" height="18" rx="9" fill="#2b2f3a" />
        <circle cx="40" cy="79" r="3" fill="#7c9cff" />
        <circle cx="60" cy="77" r="2" fill="#ffd166" />
        <circle cx="64" cy="81" r="2" fill="#5ef2c9" />
      </>
    ),
  },
};

/** SVG illustration of a built-in avatar, filling its container (circle-friendly). */
export function AvatarIllustration({ preset }: { preset: AvatarPreset }) {
  const art = ART[preset];
  const gradientId = `avatar-bg-${preset}`;
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden style={{ display: 'block' }}>
      <defs>
        <radialGradient id={gradientId} cx="50%" cy="35%" r="75%">
          <stop offset="0%" stopColor={art.colors[0]} />
          <stop offset="100%" stopColor={art.colors[1]} />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${gradientId})`} />
      {art.figure}
    </svg>
  );
}
