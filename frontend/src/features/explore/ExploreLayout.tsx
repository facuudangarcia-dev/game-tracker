import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { messages } from '../../i18n/messages';
import { ambientBackground, gradientTextSx, ink, panelSx } from '../../theme/brand';

interface ExploreHeaderProps {
  id: string;
  eyebrow: string;
  /** Title; its ending `accent` (if present in it) is shown with the brand gradient. */
  title: string;
  accent: string;
  body: string;
  icon: ReactNode;
  /** Right side on wide screens (actions, links). */
  aside?: ReactNode;
  children?: ReactNode;
}

/** Banner of the Explore pages, in the language of "Mis juegos". */
export function ExploreHeader({
  id,
  eyebrow,
  title,
  accent,
  body,
  icon,
  aside,
  children,
}: ExploreHeaderProps) {
  const index = title.toLowerCase().lastIndexOf(accent.toLowerCase());
  const [before, highlighted, after] =
    index >= 0
      ? [
          title.slice(0, index),
          title.slice(index, index + accent.length),
          title.slice(index + accent.length),
        ]
      : [title, '', ''];

  return (
    <Box
      component="section"
      aria-labelledby={id}
      sx={(theme) => ({
        position: 'relative',
        overflow: 'hidden',
        isolation: 'isolate',
        borderRadius: { xs: 3, md: 4 },
        border: `1px solid ${alpha(ink(theme), 0.08)}`,
        background: ambientBackground(theme),
        px: { xs: 2.5, sm: 4, md: 5 },
        py: { xs: 3, md: 4 },
      })}
    >
      {/* Big faded icon as a watermark. */}
      <Box
        aria-hidden
        sx={(theme) => ({
          position: 'absolute',
          right: { xs: -30, md: 24 },
          top: '50%',
          transform: 'translateY(-50%) rotate(-12deg)',
          zIndex: -1,
          color: alpha(theme.palette.primary.main, 0.12),
          '& svg': { fontSize: { xs: 150, md: 210 } },
        })}
      >
        {icon}
      </Box>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        sx={{ alignItems: { md: 'flex-end' }, justifyContent: 'space-between', gap: 2.5 }}
      >
        <Stack spacing={1.25} sx={{ minWidth: 0, maxWidth: 720 }}>
          <Typography
            variant="overline"
            color="primary"
            sx={{ fontWeight: 700, letterSpacing: 2, lineHeight: 1.5 }}
          >
            {eyebrow}
          </Typography>
          <Typography
            id={id}
            variant="h3"
            component="h1"
            sx={{
              fontWeight: 900,
              letterSpacing: { xs: -0.5, md: -1 },
              fontSize: { xs: '2rem', md: '2.75rem' },
              lineHeight: 1.05,
            }}
          >
            {before}
            <Box component="span" sx={(theme) => gradientTextSx(theme)}>
              {highlighted}
            </Box>
            {after}
          </Typography>
          <Typography color="text.secondary">{body}</Typography>
        </Stack>
        {aside ? <Box sx={{ flexShrink: 0 }}>{aside}</Box> : null}
      </Stack>
      {children ? <Box sx={{ mt: 3 }}>{children}</Box> : null}
    </Box>
  );
}

interface StatePanelProps {
  title?: string;
  body: string;
  icon?: ReactNode;
  action?: ReactNode;
}

/** Empty, not-configured or informative state of a section (never invented data). */
export function StatePanel({ title, body, icon, action }: StatePanelProps) {
  return (
    <Box
      sx={(theme) => ({
        ...panelSx(theme),
        p: { xs: 3, md: 5 },
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1.25,
      })}
    >
      <Box
        aria-hidden
        sx={(theme) => ({
          width: 56,
          height: 56,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          color: 'primary.main',
          background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.3)}, transparent 70%)`,
          '& svg': { fontSize: 32 },
        })}
      >
        {icon ?? <InfoOutlinedIcon />}
      </Box>
      {title ? (
        <Typography variant="h6" component="h2" sx={{ fontWeight: 800 }}>
          {title}
        </Typography>
      ) : null}
      <Typography color="text.secondary" sx={{ maxWidth: 520 }}>
        {body}
      </Typography>
      {action ? <Box sx={{ mt: 1 }}>{action}</Box> : null}
    </Box>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Value and label of each option; the first one is usually "all". */
  options: [string, string][];
  minWidth?: number;
}

/** Compact native select (works well on phones and with screen readers). */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  minWidth = 170,
}: FilterSelectProps) {
  return (
    <TextField
      select
      size="small"
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
      sx={{ minWidth, flex: { xs: '1 1 140px', sm: '0 0 auto' } }}
    >
      {options.map(([optionValue, optionLabel]) => (
        <option key={optionValue} value={optionValue}>
          {optionLabel}
        </option>
      ))}
    </TextField>
  );
}

/** "Load more" button of infinite lists. */
export function LoadMoreButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
      <Button
        variant="outlined"
        onClick={onClick}
        loading={loading}
        sx={{ borderRadius: 99, px: 4 }}
      >
        {messages.explore.loadMore}
      </Button>
    </Box>
  );
}
