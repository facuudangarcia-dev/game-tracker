import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SearchIcon from '@mui/icons-material/Search';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { alpha, keyframes } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { messages } from '../../i18n/messages';
import { formatYear } from '../../lib/format';
import { catalogGamePath } from '../catalog/queries';
import { GameCover } from '../library/GameCover';
import type { CatalogHighlight } from '../library/types';
import { platformsLabel } from './homeFormat';
import { ink } from '../../theme/brand';

const t = messages.home;

/** Slow "camera push" on the artwork. */
const drift = keyframes`
  from { transform: scale(1.12) translate3d(1.5%, 0, 0); }
  to { transform: scale(1.02) translate3d(0, 0, 0); }
`;

const reducedMotion = '@media (prefers-reduced-motion: reduce)';

/** Splits the title so its ending can be highlighted. */
function titleParts(title: string, accent: string): [string, string] {
  return title.endsWith(accent) ? [title.slice(0, -accent.length), accent] : [title, ''];
}

interface HomeHeroProps {
  /** Game whose artwork is the background; null keeps the abstract backdrop. */
  featured: CatalogHighlight | null;
  onExplore: () => void;
  /** Anonymous visitor: the actions become "create account" and "log in". */
  anonymous?: boolean;
}

/**
 * Cinematic hero: the featured game's artwork behind the main message, with a
 * "En portada" card linking to the game. Without artwork (loading, catalog
 * unavailable) it falls back to the abstract gradient backdrop.
 */
export function HomeHero({ featured, onExplore, anonymous = false }: HomeHeroProps) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [lead, accent] = titleParts(t.title, t.titleAccent);
  const artworkUrl = featured?.artworkUrl ?? null;
  const artworkVisible = artworkUrl !== null && loadedSrc === artworkUrl;

  return (
    <Box
      component="section"
      aria-labelledby="home-title"
      sx={(theme) => ({
        position: 'relative',
        isolation: 'isolate',
        overflow: 'hidden',
        borderRadius: { xs: 3, md: 4 },
        border: `1px solid ${alpha(ink(theme), 0.08)}`,
        bgcolor: 'background.paper',
        minHeight: { xs: 660, sm: 520, md: 580 },
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        justifyContent: { xs: 'flex-end', md: 'space-between' },
        alignItems: { xs: 'stretch', md: 'flex-end' },
        gap: 3,
        p: { xs: 3, sm: 5, md: 7 },
        boxShadow: `0 30px 80px -40px ${alpha(theme.palette.primary.main, 0.45)}`,
      })}
    >
      {/* Abstract backdrop: always there, visible until (or without) artwork. */}
      <Box
        aria-hidden
        sx={(theme) => ({
          position: 'absolute',
          inset: 0,
          zIndex: -3,
          background: [
            `radial-gradient(circle at 85% 15%, ${alpha(theme.palette.primary.main, 0.35)}, transparent 45%)`,
            `radial-gradient(circle at 70% 90%, ${alpha(theme.palette.secondary.main, 0.18)}, transparent 40%)`,
            theme.palette.background.paper,
          ].join(', '),
        })}
      />

      {artworkUrl ? (
        <Box
          key={artworkUrl}
          component="img"
          src={artworkUrl}
          alt=""
          aria-hidden
          onLoad={() => setLoadedSrc(artworkUrl)}
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: -2,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 30%',
            opacity: artworkVisible ? 1 : 0,
            transition: 'opacity 1.2s ease',
            animation: `${drift} 24s ease-out forwards`,
            [reducedMotion]: { animation: 'none', transition: 'none' },
          }}
        />
      ) : null}

      {/* Scrims: keep the text readable over any artwork. */}
      <Box
        aria-hidden
        sx={(theme) => {
          const bg = theme.palette.background.default;
          return {
            position: 'absolute',
            inset: 0,
            zIndex: -1,
            background: {
              xs: `linear-gradient(0deg, ${bg} 45%, ${alpha(bg, 0.6)} 68%, ${alpha(bg, 0.05)} 100%)`,
              md: [
                `linear-gradient(90deg, ${alpha(bg, 0.96)} 0%, ${alpha(bg, 0.8)} 38%, ${alpha(bg, 0.15)} 75%, transparent 100%)`,
                `linear-gradient(0deg, ${alpha(bg, 0.85)} 0%, transparent 40%)`,
              ].join(', '),
            },
          };
        }}
      />
      {/* Subtle scanlines: a nod to screens, not a copy of anyone's style. */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: -1,
          opacity: 0.06,
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.6) 0 1px, transparent 1px 4px)',
          pointerEvents: 'none',
        }}
      />

      <Stack spacing={2.5} sx={{ maxWidth: 640, alignItems: 'flex-start' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'primary.main' }}>
          <SportsEsportsIcon aria-hidden fontSize="small" />
          <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 2 }}>
            {t.eyebrow}
          </Typography>
        </Stack>
        <Typography
          id="home-title"
          variant="h2"
          component="h1"
          sx={{
            fontWeight: 900,
            lineHeight: 1.02,
            letterSpacing: { xs: -1, md: -2 },
            fontSize: { xs: '2.4rem', sm: '3.2rem', md: '4.2rem' },
            textWrap: 'balance',
          }}
        >
          {lead}
          {accent ? (
            <Box
              component="span"
              sx={(theme) => ({
                background: `linear-gradient(100deg, ${theme.palette.primary.main} 10%, #b48cff 55%, ${theme.palette.secondary.main} 100%)`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              })}
            >
              {accent}
            </Box>
          ) : null}
        </Typography>
        <Typography
          variant="h6"
          component="p"
          sx={{ fontWeight: 400, color: 'text.secondary', maxWidth: 560, textWrap: 'pretty' }}
        >
          {t.body}
        </Typography>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ pt: 1, width: { xs: '100%', sm: 'auto' } }}
        >
          {anonymous ? (
            <Button
              variant="contained"
              size="large"
              component={RouterLink}
              to="/register"
              startIcon={<PersonAddIcon />}
            >
              {messages.auth.register.title}
            </Button>
          ) : (
            <Button variant="contained" size="large" startIcon={<SearchIcon />} onClick={onExplore}>
              {t.explore}
            </Button>
          )}
          <Button
            variant="outlined"
            size="large"
            component={RouterLink}
            to={anonymous ? '/login' : '/games'}
            sx={(theme) => ({
              bgcolor: alpha(theme.palette.background.default, 0.4),
              backdropFilter: 'blur(6px)',
            })}
          >
            {anonymous ? messages.auth.login.title : t.library}
          </Button>
        </Stack>
      </Stack>

      {featured ? <FeaturedCard game={featured} /> : null}
    </Box>
  );
}

/** Glass card naming the game behind the hero, linking to its catalog page. */
function FeaturedCard({ game }: { game: CatalogHighlight }) {
  const year = formatYear(game.releaseDate);
  const platforms = platformsLabel(game);

  return (
    <Box
      component={RouterLink}
      to={catalogGamePath(game.provider, game.externalId)}
      aria-label={`${t.featured}: ${game.name}. ${t.viewGame}`}
      sx={(theme) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 1.25,
        pr: 2,
        width: { xs: '100%', md: 320 },
        flexShrink: 0,
        color: 'inherit',
        textDecoration: 'none',
        borderRadius: 2.5,
        bgcolor: alpha(theme.palette.background.default, 0.55),
        border: `1px solid ${alpha(ink(theme), 0.12)}`,
        backdropFilter: 'blur(14px)',
        transition: 'transform .2s ease, border-color .2s ease',
        '&:hover, &:focus-visible': {
          transform: 'translateY(-2px)',
          borderColor: alpha(theme.palette.primary.main, 0.7),
        },
        '&:hover .featured-arrow, &:focus-visible .featured-arrow': {
          transform: 'translateX(3px)',
        },
      })}
    >
      <GameCover src={game.coverUrl} name={game.name} width={48} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant="caption"
          color="secondary"
          sx={{ fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' }}
        >
          {t.featured}
        </Typography>
        <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700 }}>
          {game.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap component="p">
          {[year, platforms].filter(Boolean).join(' · ')}
        </Typography>
      </Box>
      <ArrowForwardIcon
        className="featured-arrow"
        fontSize="small"
        aria-hidden
        sx={{ color: 'primary.main', transition: 'transform .2s ease' }}
      />
    </Box>
  );
}
