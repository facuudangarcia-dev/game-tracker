import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import { alpha, type Theme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { messages } from '../../i18n/messages';
import { SectionHeading } from './SectionHeading';
import { ink } from '../../theme/brand';

const t = messages.home.features;

type Span = Partial<Record<'xs' | 'sm' | 'md', number>>;

interface TileProps {
  title: string;
  body: string;
  /** Illustrative mini UI (decorative: hidden from assistive tech). */
  visual: ReactNode;
  columns?: Span;
  rows?: Span;
  /** Glow color of the tile on hover. */
  accent?: (theme: Theme) => string;
}

const spanOf = (span: Span | undefined) =>
  span ? Object.fromEntries(Object.entries(span).map(([bp, n]) => [bp, `span ${n}`])) : undefined;

function Tile({ title, body, visual, columns, rows, accent }: TileProps) {
  return (
    <Box
      component="li"
      sx={(theme) => {
        const color = accent?.(theme) ?? theme.palette.primary.main;
        return {
          gridColumn: spanOf(columns),
          gridRow: spanOf(rows),
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          p: { xs: 2.5, md: 3 },
          borderRadius: 3,
          border: `1px solid ${theme.palette.divider}`,
          background: `linear-gradient(160deg, ${alpha(color, 0.1)} 0%, ${theme.palette.background.paper} 45%)`,
          transition: 'border-color .25s ease, transform .25s ease',
          '&:hover': { borderColor: alpha(color, 0.6), transform: 'translateY(-3px)' },
          '@media (prefers-reduced-motion: reduce)': {
            transition: 'none',
            '&:hover': { transform: 'none' },
          },
        };
      }}
    >
      <Box aria-hidden sx={{ flex: 1, display: 'flex', alignItems: 'center', minHeight: 72 }}>
        {visual}
      </Box>
      <Box>
        <Typography variant="h6" component="h3" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {body}
        </Typography>
      </Box>
    </Box>
  );
}

/** Mini list of playthroughs with their status. */
function PlaythroughsVisual() {
  const rows = [
    { status: messages.status.COMPLETED, color: 'success' as const, progress: 100 },
    { status: messages.status.IN_PROGRESS, color: 'info' as const, progress: 62 },
    { status: messages.status.PENDING, color: 'default' as const, progress: 0 },
  ];
  return (
    <Stack spacing={1.25} sx={{ width: '100%' }}>
      {rows.map((row, index) => (
        <Box
          key={row.status}
          sx={(theme) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: 1.25,
            borderRadius: 2,
            bgcolor: alpha(ink(theme), 0.04),
            border: `1px solid ${alpha(ink(theme), 0.06)}`,
          })}
        >
          <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 82 }}>
            {t.playthroughs.example(index + 1)}
          </Typography>
          <Box
            sx={(theme) => ({
              flex: 1,
              height: 6,
              borderRadius: 3,
              bgcolor: alpha(ink(theme), 0.08),
              overflow: 'hidden',
            })}
          >
            <Box
              sx={(theme) => ({
                width: `${row.progress}%`,
                height: '100%',
                background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              })}
            />
          </Box>
          <Chip size="small" label={row.status} color={row.color} variant="outlined" />
        </Box>
      ))}
    </Stack>
  );
}

/** Total time with a small bar chart of sessions. */
function TimeVisual() {
  const sessions = [35, 60, 20, 80, 45, 95, 55, 70, 30, 85, 65, 100];
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={3}
      sx={{ width: '100%', alignItems: { xs: 'flex-start', sm: 'flex-end' } }}
    >
      <Typography
        sx={{
          fontSize: { xs: '2.25rem', md: '2.75rem' },
          fontWeight: 900,
          letterSpacing: -1,
          lineHeight: 1,
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {t.time.example}
      </Typography>
      <Stack
        direction="row"
        spacing={0.75}
        sx={{ flex: { sm: 1 }, flexShrink: 0, height: 64, alignItems: 'flex-end', width: '100%' }}
      >
        {sessions.map((height, index) => (
          <Box
            key={index}
            sx={(theme) => ({
              flex: 1,
              height: `${height}%`,
              borderRadius: 1,
              background: `linear-gradient(0deg, ${alpha(theme.palette.primary.main, 0.35)}, ${theme.palette.primary.main})`,
            })}
          />
        ))}
      </Stack>
    </Stack>
  );
}

function DifficultyVisual() {
  const selected = t.difficulty.examples.length - 1;
  return (
    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
      {t.difficulty.examples.map((name, index) => (
        <Chip
          key={name}
          label={name}
          size="small"
          color={index === selected ? 'primary' : 'default'}
          variant={index === selected ? 'filled' : 'outlined'}
        />
      ))}
    </Stack>
  );
}

function PlatinumVisual() {
  return (
    <Box
      sx={(theme) => ({
        width: 64,
        height: 64,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        background: `radial-gradient(circle, ${alpha(theme.palette.secondary.main, 0.35)}, transparent 70%)`,
      })}
    >
      <EmojiEventsIcon
        sx={(theme) => ({
          fontSize: 42,
          color: 'secondary.main',
          filter: `drop-shadow(0 0 12px ${alpha(theme.palette.secondary.main, 0.8)})`,
        })}
      />
    </Box>
  );
}

function RatingVisual() {
  const value = t.rating.example;
  return (
    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
      <CircularProgress
        variant="determinate"
        value={100}
        size={72}
        thickness={4}
        sx={(theme) => ({ color: alpha(ink(theme), 0.08), position: 'absolute' })}
      />
      <CircularProgress variant="determinate" value={value} size={72} thickness={4} />
      <Typography
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          fontWeight: 900,
          fontSize: '1.4rem',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function NotesVisual() {
  return (
    <Box
      sx={(theme) => ({
        width: '100%',
        pl: 2,
        borderLeft: `3px solid ${theme.palette.primary.main}`,
      })}
    >
      <Typography sx={{ fontStyle: 'italic', fontSize: { xs: '1rem', md: '1.15rem' } }}>
        {t.notes.example}
      </Typography>
    </Box>
  );
}

/**
 * The main features of Game Tracker as an asymmetric grid of tiles, each with a
 * small illustrative visual (examples, not the user's data).
 */
export function FeatureBento() {
  const secondary = (theme: Theme) => theme.palette.secondary.main;
  return (
    <Box component="section" aria-labelledby="home-features">
      <SectionHeading id="home-features" eyebrow={t.eyebrow} title={t.title} />
      <Box
        component="ul"
        sx={{
          listStyle: 'none',
          m: 0,
          mt: 2.5,
          p: 0,
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gridAutoRows: 'minmax(190px, auto)',
        }}
      >
        <Tile
          title={t.playthroughs.title}
          body={t.playthroughs.body}
          visual={<PlaythroughsVisual />}
          columns={{ sm: 2, md: 2 }}
          rows={{ md: 2 }}
        />
        <Tile
          title={t.time.title}
          body={t.time.body}
          visual={<TimeVisual />}
          columns={{ sm: 2, md: 2 }}
        />
        <Tile title={t.difficulty.title} body={t.difficulty.body} visual={<DifficultyVisual />} />
        <Tile
          title={t.platinum.title}
          body={t.platinum.body}
          visual={<PlatinumVisual />}
          accent={secondary}
        />
        <Tile title={t.rating.title} body={t.rating.body} visual={<RatingVisual />} />
        <Tile
          title={t.notes.title}
          body={t.notes.body}
          visual={<NotesVisual />}
          columns={{ md: 3 }}
          accent={secondary}
        />
      </Box>
    </Box>
  );
}
