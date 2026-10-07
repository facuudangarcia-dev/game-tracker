import { alpha, type Theme } from '@mui/material/styles';

/**
 * Game Tracker's visual language, shared by Home, Mis juegos, the game page and the
 * profile: blue → violet → warm gradient, glass panels and soft glows.
 */
export const VIOLET = '#b48cff';

/** Signature gradient (primary → violet → warm accent). */
export function brandGradient(theme: Theme, angle = 100): string {
  return `linear-gradient(${angle}deg, ${theme.palette.primary.main} 10%, ${VIOLET} 55%, ${theme.palette.secondary.main} 100%)`;
}

/** Gradient text (use on a span inside a heading). */
export function gradientTextSx(theme: Theme) {
  return {
    background: brandGradient(theme),
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  } as const;
}

/** Panel with a faint colored wash from the top-left corner and a subtle border. */
export function panelSx(theme: Theme, accent: string = theme.palette.primary.main) {
  return {
    borderRadius: 3,
    border: `1px solid ${theme.palette.divider}`,
    background: `linear-gradient(160deg, ${alpha(accent, 0.09)} 0%, ${theme.palette.background.paper} 45%)`,
  } as const;
}

/** Frosted glass, for elements on top of artwork. */
export function glassSx(theme: Theme, opacity = 0.55) {
  return {
    bgcolor: alpha(theme.palette.background.default, opacity),
    border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
    backdropFilter: 'blur(14px)',
  } as const;
}

/** Ambient backdrop: two soft radial glows over the paper color. */
export function ambientBackground(theme: Theme): string {
  return [
    `radial-gradient(circle at 85% 15%, ${alpha(theme.palette.primary.main, 0.3)}, transparent 45%)`,
    `radial-gradient(circle at 10% 100%, ${alpha(theme.palette.secondary.main, 0.14)}, transparent 40%)`,
    theme.palette.background.paper,
  ].join(', ');
}

/** Status colors, shared by chips, dots and stats. */
export function statusColor(theme: Theme, status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED') {
  return {
    PENDING: theme.palette.grey[500],
    IN_PROGRESS: theme.palette.info.main,
    COMPLETED: theme.palette.success.main,
  }[status];
}

export const reducedMotion = '@media (prefers-reduced-motion: reduce)';

/** Poster/card links (Home rails, related games): lift on hover and a slight image zoom. */
export const posterLinkSx = {
  display: 'block',
  color: 'inherit',
  textDecoration: 'none',
  borderRadius: 2,
  outlineOffset: 3,
  '& .card-media': {
    position: 'relative',
    borderRadius: 2,
    overflow: 'hidden',
    transition: 'transform .25s ease, box-shadow .25s ease',
  },
  '& .card-media img': { transition: 'transform .4s ease' },
  '&:hover .card-media, &:focus-visible .card-media': {
    transform: 'translateY(-6px)',
  },
  '&:hover .card-media img, &:focus-visible .card-media img': { transform: 'scale(1.05)' },
  '@media (prefers-reduced-motion: reduce)': {
    '& .card-media, & .card-media img': { transition: 'none' },
    '&:hover .card-media, &:hover .card-media img': { transform: 'none' },
  },
} as const;

/** Tone of a dialog: regular, or "danger" for destructive confirmations. */
export type DialogTone = 'default' | 'danger';

/** Main color of a dialog tone. */
export function toneColor(theme: Theme, tone: DialogTone): string {
  return tone === 'danger' ? theme.palette.error.main : theme.palette.primary.main;
}

/**
 * Surface of every dialog (reference: "Agregar juego"): dark, subtle border, soft
 * glow in the tone's color, and form fields in Game Tracker's style.
 */
export function dialogPaperSx(theme: Theme, fullScreen: boolean, tone: DialogTone = 'default') {
  const color = toneColor(theme, tone);
  return {
    borderRadius: fullScreen ? 0 : 4,
    overflow: 'hidden',
    backgroundImage: 'none',
    bgcolor: 'background.default',
    border: fullScreen ? 'none' : `1px solid ${alpha(theme.palette.common.white, 0.1)}`,
    boxShadow: `0 40px 90px -30px ${alpha(color, 0.55)}`,
    '& .MuiOutlinedInput-root': {
      borderRadius: 2,
      bgcolor: alpha(theme.palette.common.white, 0.03),
      '& fieldset': { borderColor: alpha(theme.palette.common.white, 0.12) },
      '&:hover fieldset': { borderColor: alpha(theme.palette.primary.main, 0.6) },
    },
  } as const;
}

/** Main action of a dialog: the brand gradient, or a red one for destructive actions. */
export function primaryActionSx(theme: Theme, tone: DialogTone = 'default') {
  const background =
    tone === 'danger'
      ? `linear-gradient(110deg, ${theme.palette.error.light} 0%, ${theme.palette.error.dark} 100%)`
      : brandGradient(theme, 110);
  return {
    px: 3,
    fontWeight: 800,
    color: theme.palette.common.white,
    background,
    boxShadow: `0 12px 28px -12px ${alpha(toneColor(theme, tone), 0.9)}`,
    '&:hover': { background, filter: 'brightness(1.08)' },
    '&.Mui-disabled': {
      background: alpha(theme.palette.common.white, 0.08),
      color: theme.palette.text.disabled,
      boxShadow: 'none',
    },
  } as const;
}
