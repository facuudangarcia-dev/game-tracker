import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { SwordIcon } from '../../components/SwordIcon';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import type { FormEvent, ReactNode } from 'react';
import { messages } from '../../i18n/messages';
import { brandGradient, gradientTextSx, ink, VIOLET } from '../../theme/brand';

interface AuthCardProps {
  title: string;
  /** Short line under the title. */
  subtitle?: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}

const PERK_ICONS = [
  <VideoLibraryIcon key="library" />,
  <AutoGraphIcon key="time" />,
  <EmojiEventsIcon key="trophy" />,
];

/** Gamepad in the brand's gradient badge (same mark as the header logo). */
function BrandBadge({ size }: { size: number }) {
  return (
    <Box
      aria-hidden
      sx={(theme) => ({
        width: size,
        height: size,
        display: 'grid',
        placeItems: 'center',
        filter: `drop-shadow(0 0 8px ${alpha(theme.palette.primary.main, 0.6)})`,
        '& svg': { fontSize: size * 0.95 },
      })}
    >
      <SwordIcon gradient />
    </Box>
  );
}

/** Left half on wide screens: what Game Tracker is, over the brand's ambient glow. */
function BrandShowcase() {
  const home = messages.home;
  const lead = home.title.endsWith(home.titleAccent)
    ? home.title.slice(0, -home.titleAccent.length)
    : home.title;
  const accent = home.title.endsWith(home.titleAccent) ? home.titleAccent : '';
  return (
    <Box
      aria-hidden
      sx={(theme) => ({
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 4,
        p: 5,
        position: 'relative',
        overflow: 'hidden',
        borderRight: `1px solid ${alpha(ink(theme), 0.06)}`,
        background: [
          `radial-gradient(circle at 15% 10%, ${alpha(theme.palette.primary.main, 0.32)}, transparent 50%)`,
          `radial-gradient(circle at 90% 85%, ${alpha(VIOLET, 0.24)}, transparent 50%)`,
          `radial-gradient(circle at 60% 120%, ${alpha(theme.palette.secondary.main, 0.16)}, transparent 45%)`,
          alpha(theme.palette.background.default, 0.6),
        ].join(', '),
        // Faint grid, like a HUD.
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(${alpha(ink(theme), 0.035)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(ink(theme), 0.035)} 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
          maskImage: 'linear-gradient(180deg, black, transparent 85%)',
          pointerEvents: 'none',
        },
      })}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', position: 'relative' }}>
        <BrandBadge size={40} />
        <Typography sx={{ fontWeight: 900, fontSize: '1.3rem', letterSpacing: -0.4 }}>
          {messages.app.name}
        </Typography>
      </Stack>

      <Box sx={{ position: 'relative' }}>
        <Typography
          sx={{
            fontWeight: 900,
            fontSize: '2.1rem',
            lineHeight: 1.12,
            letterSpacing: -0.8,
            textWrap: 'balance',
          }}
        >
          {lead}
          <Box component="span" sx={(theme) => gradientTextSx(theme)}>
            {accent}
          </Box>
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1.5, textWrap: 'pretty' }}>
          {home.join.body}
        </Typography>
      </Box>

      <Stack spacing={1.25} sx={{ position: 'relative' }}>
        {home.join.perks.map((perk, index) => (
          <Stack
            key={perk}
            direction="row"
            spacing={1.5}
            sx={(theme) => ({
              alignItems: 'center',
              p: 1.25,
              borderRadius: 2,
              bgcolor: alpha(ink(theme), 0.03),
              border: `1px solid ${alpha(ink(theme), 0.07)}`,
              backdropFilter: 'blur(6px)',
            })}
          >
            <Box
              sx={(theme) => ({
                width: 32,
                height: 32,
                borderRadius: 1.5,
                flexShrink: 0,
                display: 'grid',
                placeItems: 'center',
                color: theme.palette.primary.light,
                bgcolor: alpha(theme.palette.primary.main, 0.14),
                '& svg': { fontSize: 18 },
              })}
            >
              {PERK_ICONS[index % PERK_ICONS.length]}
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {perk}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

/**
 * Auth screen shared by login, register and email verification: a dark glass card
 * with the brand showcase on the left (wide screens) and the form on the right.
 */
export function AuthCard({ title, subtitle, onSubmit, children }: AuthCardProps) {
  return (
    <Box
      sx={(theme) => ({
        maxWidth: { xs: 460, md: 980 },
        mx: 'auto',
        mt: { xs: 1, md: 4 },
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 460px)' },
        borderRadius: 4,
        overflow: 'hidden',
        position: 'relative',
        border: `1px solid ${alpha(ink(theme), 0.09)}`,
        bgcolor: 'background.paper',
        backgroundImage: `linear-gradient(160deg, ${alpha(theme.palette.primary.main, 0.07)} 0%, transparent 40%)`,
        boxShadow: `inset 0 1px 0 ${alpha(ink(theme), 0.06)}, 0 30px 60px -24px rgba(0, 0, 0, 0.75)`,
        // Signature gradient line on top, like the header's.
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: brandGradient(theme, 90),
          zIndex: 1,
        },
      })}
    >
      <BrandShowcase />
      <Stack
        component="form"
        spacing={2.5}
        noValidate
        onSubmit={onSubmit}
        sx={{ p: { xs: 3, sm: 4.5 }, justifyContent: 'center' }}
      >
        <Box>
          <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 2 }}>
            <BrandBadge size={40} />
          </Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 900, letterSpacing: -0.6 }}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        {children}
      </Stack>
    </Box>
  );
}
