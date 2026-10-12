import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import { calendarParts } from './homeFormat';
import { ink } from '../../theme/brand';

interface CalendarBadgeProps {
  /** YYYY-MM-DD. */
  date: string;
  /** `md`: over artwork (Home rail, releases). `sm`: in lists (Home side panel). */
  size?: 'sm' | 'md';
  /** Hidden from assistive technology when the date is already said elsewhere. */
  decorative?: boolean;
}

/** "Calendar page" date: month band, day and (md) year. Shared by the Home and the releases calendar. */
export function CalendarBadge({ date, size = 'md', decorative = false }: CalendarBadgeProps) {
  const parts = calendarParts(date);
  const md = size === 'md';
  return (
    <Box
      aria-hidden={decorative || undefined}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : parts.long}
      sx={(theme) => ({
        width: md ? 52 : 38,
        flexShrink: 0,
        borderRadius: md ? 1.5 : 1.25,
        overflow: 'hidden',
        textAlign: 'center',
        bgcolor: md ? alpha(theme.palette.background.default, 0.75) : alpha(ink(theme), 0.03),
        backdropFilter: md ? 'blur(8px)' : undefined,
        border: `1px solid ${alpha(ink(theme), md ? 0.14 : 0.12)}`,
      })}
    >
      <Box
        aria-hidden
        sx={{
          bgcolor: 'secondary.main',
          color: 'secondary.contrastText',
          fontSize: md ? '0.65rem' : '0.55rem',
          fontWeight: 800,
          letterSpacing: md ? 1 : 0.8,
          textTransform: 'uppercase',
          py: md ? 0.25 : 0,
        }}
      >
        {parts.month}
      </Box>
      <Box
        aria-hidden
        sx={{ fontSize: md ? '1.35rem' : '1rem', fontWeight: 900, lineHeight: md ? 1.3 : 1.4 }}
      >
        {parts.day}
      </Box>
      {md ? (
        <Box aria-hidden sx={{ fontSize: '0.6rem', color: 'text.secondary', pb: 0.25 }}>
          {parts.year}
        </Box>
      ) : null}
    </Box>
  );
}
