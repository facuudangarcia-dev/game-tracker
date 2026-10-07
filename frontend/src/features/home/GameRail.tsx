import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { type ReactNode, useRef } from 'react';
import { Link as RouterLink } from 'react-router';
import { messages } from '../../i18n/messages';
import { formatYear } from '../../lib/format';
import { catalogGamePath } from '../catalog/queries';
import { GameCover } from '../library/GameCover';
import type { CatalogHighlight } from '../library/types';
import { calendarParts, platformsLabel } from './homeFormat';
import { SectionHeading } from './SectionHeading';

const t = messages.home;

type Columns = Partial<Record<'xs' | 'sm' | 'md', number>>;

interface RailProps {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  /** Visible cards per breakpoint (fractional values hint that it scrolls). */
  columns: Columns;
  loading: boolean;
  skeletonRatio: string;
  children: ReactNode;
}

/** Horizontally scrolling row with snap points and arrow controls on larger screens. */
function Rail({
  id,
  eyebrow,
  title,
  subtitle,
  columns,
  loading,
  skeletonRatio,
  children,
}: RailProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const scroll = (direction: 1 | -1) =>
    listRef.current?.scrollBy({
      left: direction * listRef.current.clientWidth * 0.85,
      behavior: 'smooth',
    });

  const gap = 16;
  const columnWidth = Object.fromEntries(
    Object.entries(columns).map(([breakpoint, count]) => [
      breakpoint,
      `calc((100% - ${(Math.ceil(count) - 1) * gap}px) / ${count})`,
    ]),
  );

  return (
    <Box component="section" aria-labelledby={id}>
      <SectionHeading
        id={id}
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        actions={
          <Stack direction="row" spacing={1} sx={{ display: { xs: 'none', sm: 'flex' } }}>
            <IconButton aria-label={t.railPrevious} onClick={() => scroll(-1)} sx={railButtonSx}>
              <ChevronLeftIcon />
            </IconButton>
            <IconButton aria-label={t.railNext} onClick={() => scroll(1)} sx={railButtonSx}>
              <ChevronRightIcon />
            </IconButton>
          </Stack>
        }
      />
      <Box
        ref={listRef}
        component="ul"
        aria-labelledby={id}
        aria-busy={loading || undefined}
        sx={{
          listStyle: 'none',
          m: 0,
          mt: 2.5,
          // Room for the hover lift and glow without clipping.
          pt: 1,
          pb: 2,
          px: 0.5,
          mx: -0.5,
          display: 'grid',
          gridAutoFlow: 'column',
          gridAutoColumns: columnWidth,
          gap: `${gap}px`,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {loading
          ? Array.from({ length: 6 }, (_, i) => (
              <Box component="li" key={i}>
                <Skeleton
                  variant="rounded"
                  sx={{ width: '100%', height: 'auto', aspectRatio: skeletonRatio }}
                />
                <Skeleton width="70%" sx={{ mt: 1 }} />
              </Box>
            ))
          : children}
      </Box>
    </Box>
  );
}

const railButtonSx = {
  border: 1,
  borderColor: 'divider',
  '&:hover': { borderColor: 'primary.main' },
} as const;

/** Card shared styles: snap, lift on hover and a soft glow. */
const cardLinkSx = {
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

interface HighlightsRailProps {
  games: CatalogHighlight[];
  loading: boolean;
}

/** Recent releases as posters, with their position in the "most anticipated" ranking. */
export function RecentReleasesRail({ games, loading }: HighlightsRailProps) {
  return (
    <Rail
      id="home-recent"
      eyebrow={t.recent.eyebrow}
      title={t.recent.title}
      subtitle={t.recent.subtitle}
      columns={{ xs: 2.3, sm: 3.5, md: 6 }}
      loading={loading}
      skeletonRatio="3 / 4"
    >
      {games.map((game, index) => {
        const year = formatYear(game.releaseDate);
        return (
          <Box component="li" key={game.externalId} sx={{ scrollSnapAlign: 'start', minWidth: 0 }}>
            <Box
              component={RouterLink}
              to={catalogGamePath(game.provider, game.externalId)}
              sx={(theme) => ({
                ...cardLinkSx,
                '&:hover .card-media, &:focus-visible .card-media': {
                  transform: 'translateY(-6px)',
                  boxShadow: `0 18px 40px -18px ${alpha(theme.palette.primary.main, 0.8)}, 0 0 0 1px ${alpha(theme.palette.primary.main, 0.6)}`,
                },
              })}
            >
              <Box className="card-media">
                <GameCover src={game.coverUrl} name={game.name} square />
                <Box
                  aria-hidden
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(0deg, rgba(0,0,0,0.75) 0%, transparent 45%)',
                    pointerEvents: 'none',
                  }}
                />
                <Typography
                  component="span"
                  aria-label={t.rank(index + 1)}
                  sx={(theme) => ({
                    position: 'absolute',
                    left: 10,
                    bottom: 2,
                    fontSize: { xs: '2.4rem', md: '2.8rem' },
                    fontWeight: 900,
                    lineHeight: 1,
                    letterSpacing: -2,
                    color: 'transparent',
                    WebkitTextStroke: `1.5px ${alpha(theme.palette.common.white, 0.9)}`,
                    fontVariantNumeric: 'tabular-nums',
                  })}
                >
                  {String(index + 1).padStart(2, '0')}
                </Typography>
              </Box>
              <Typography variant="subtitle2" noWrap sx={{ mt: 1.25, fontWeight: 700 }}>
                {game.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap component="p">
                {[year, platformsLabel(game, 2)].filter(Boolean).join(' · ')}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Rail>
  );
}

/** Upcoming releases as wide artwork cards with a "calendar page" date badge. */
export function UpcomingReleasesRail({ games, loading }: HighlightsRailProps) {
  return (
    <Rail
      id="home-upcoming"
      eyebrow={t.upcoming.eyebrow}
      title={t.upcoming.title}
      subtitle={t.upcoming.subtitle}
      columns={{ xs: 1.2, sm: 2.2, md: 3 }}
      loading={loading}
      skeletonRatio="16 / 9"
    >
      {games.map((game) => {
        const date = game.releaseDate ? calendarParts(game.releaseDate) : null;
        const image = game.artworkUrl ?? game.coverUrl;
        return (
          <Box component="li" key={game.externalId} sx={{ scrollSnapAlign: 'start', minWidth: 0 }}>
            <Box
              component={RouterLink}
              to={catalogGamePath(game.provider, game.externalId)}
              sx={(theme) => ({
                ...cardLinkSx,
                '&:hover .card-media, &:focus-visible .card-media': {
                  transform: 'translateY(-6px)',
                  boxShadow: `0 18px 40px -18px ${alpha(theme.palette.secondary.main, 0.7)}, 0 0 0 1px ${alpha(theme.palette.secondary.main, 0.55)}`,
                },
              })}
            >
              <Box className="card-media" sx={{ aspectRatio: '16 / 9', bgcolor: 'action.hover' }}>
                {image ? (
                  <Box
                    component="img"
                    src={image}
                    alt={game.name}
                    loading="lazy"
                    sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : null}
                <Box
                  aria-hidden
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(0deg, rgba(10,12,16,0.95) 0%, rgba(10,12,16,0.35) 50%, transparent 75%)',
                  }}
                />
                {date ? (
                  <Box
                    aria-label={t.releaseDate(date.long)}
                    sx={(theme) => ({
                      position: 'absolute',
                      top: 10,
                      left: 10,
                      width: 52,
                      borderRadius: 1.5,
                      overflow: 'hidden',
                      textAlign: 'center',
                      bgcolor: alpha(theme.palette.background.default, 0.75),
                      backdropFilter: 'blur(8px)',
                      border: `1px solid ${alpha(theme.palette.common.white, 0.14)}`,
                    })}
                  >
                    <Box
                      aria-hidden
                      sx={{
                        bgcolor: 'secondary.main',
                        color: 'secondary.contrastText',
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        letterSpacing: 1,
                        textTransform: 'uppercase',
                        py: 0.25,
                      }}
                    >
                      {date.month}
                    </Box>
                    <Box aria-hidden sx={{ fontSize: '1.35rem', fontWeight: 900, lineHeight: 1.3 }}>
                      {date.day}
                    </Box>
                    <Box aria-hidden sx={{ fontSize: '0.6rem', color: 'text.secondary', pb: 0.25 }}>
                      {date.year}
                    </Box>
                  </Box>
                ) : null}
                <Box sx={{ position: 'absolute', left: 14, right: 14, bottom: 10 }}>
                  <Typography variant="subtitle1" noWrap sx={{ fontWeight: 800 }}>
                    {game.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap component="p">
                    {platformsLabel(game)}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        );
      })}
    </Rail>
  );
}
