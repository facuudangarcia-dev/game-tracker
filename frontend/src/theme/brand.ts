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
