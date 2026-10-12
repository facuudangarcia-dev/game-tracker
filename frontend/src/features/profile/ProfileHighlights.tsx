import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import BoltIcon from '@mui/icons-material/Bolt';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ScheduleIcon from '@mui/icons-material/Schedule';
import StarIcon from '@mui/icons-material/Star';
import StarHalfIcon from '@mui/icons-material/StarHalf';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { alpha, type Theme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { Link as RouterLink } from 'react-router';
import { messages } from '../../i18n/messages';
import { formatMinutes } from '../../lib/format';
import { FAVORITE_COLOR, panelSx, VIOLET } from '../../theme/brand';
import { GameCover } from '../library/GameCover';
import { FAVORITES_MAX, type PlayerHighlights, type ProfileGame, usePlayerHighlights } from './api';

const t = messages.profile.highlights;

/**
 * Where a game links to and whether the highlights are the current user's own:
 * a friend's profile (decision #85) links to their read-only games.
 */
const HighlightsContext = createContext<{ gamePath: (userGameId: string) => string; own: boolean }>(
  { gamePath: (userGameId) => `/games/${userGameId}`, own: true },
);

/** Row linking to the player's game: cover, name and platform (+ optional extra content). */
function GameLink({
  game,
  coverWidth,
  children,
}: {
  game: ProfileGame;
  coverWidth: number;
  children?: ReactNode;
}) {
  const { gamePath } = useContext(HighlightsContext);
  return (
    <Box
      component={RouterLink}
      to={gamePath(game.userGameId)}
      sx={(theme) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 0.75,
        mx: -0.75,
        borderRadius: 2,
        color: 'inherit',
        textDecoration: 'none',
        '&:hover, &:focus-visible': { bgcolor: alpha(theme.palette.primary.main, 0.1) },
      })}
    >
      <GameCover src={game.coverUrl} name={game.name} width={coverWidth} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontWeight: 800, lineHeight: 1.25 }} noWrap title={game.name}>
          {game.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
          {game.platform.shortName}
        </Typography>
        {children}
      </Box>
    </Box>
  );
}

/** Panel heading: colored icon tile + overline title (+ something on the right). */
function PanelHeading({
  id,
  icon,
  accent,
  title,
  aside,
}: {
  id: string;
  icon: ReactNode;
  accent: (theme: Theme) => string;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mb: 1.5 }}>
      <Box
        aria-hidden
        sx={(theme) => ({
          width: 30,
          height: 30,
          borderRadius: 1.5,
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          color: accent(theme),
          bgcolor: alpha(accent(theme), 0.14),
          '& svg': { fontSize: 18 },
        })}
      >
        {icon}
      </Box>
      <Typography
        id={id}
        variant="overline"
        component="h2"
        sx={{ fontWeight: 800, letterSpacing: 1.4, lineHeight: 1.4, flex: 1 }}
      >
        {title}
      </Typography>
      {aside}
    </Stack>
  );
}

/** A single highlight: the game and its figure (time or rating), or an empty hint. */
function HighlightCard({
  id,
  title,
  icon,
  accent,
  game,
  value,
  detail,
  empty,
}: {
  id: string;
  title: string;
  icon: ReactNode;
  accent: (theme: Theme) => string;
  game: ProfileGame | null;
  value?: string;
  detail?: string;
  empty: string;
}) {
  return (
    <Box
      component="section"
      aria-labelledby={id}
      sx={(theme) => ({ ...panelSx(theme, accent(theme)), p: 2 })}
    >
      <PanelHeading id={id} icon={icon} accent={accent} title={title} />
      {game ? (
        <GameLink game={game} coverWidth={46}>
          {detail ? (
            <Typography variant="caption" color="text.secondary" component="p" noWrap>
              {detail}
            </Typography>
          ) : null}
        </GameLink>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {empty}
        </Typography>
      )}
      {game && value ? (
        <Typography
          sx={(theme) => ({
            mt: 1,
            fontWeight: 900,
            fontSize: '1.45rem',
            lineHeight: 1,
            color: accent(theme),
          })}
        >
          {value}
        </Typography>
      ) : null}
    </Box>
  );
}

function FavoritesPanel({ favorites }: { favorites: ProfileGame[] }) {
  const { own } = useContext(HighlightsContext);
  return (
    <Box
      component="section"
      aria-labelledby="profile-favorites"
      sx={(theme) => ({ ...panelSx(theme, FAVORITE_COLOR), p: 2 })}
    >
      <PanelHeading
        id="profile-favorites"
        icon={<FavoriteIcon />}
        accent={() => FAVORITE_COLOR}
        title={t.favorites}
        aside={
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
            {t.favoritesCount(favorites.length, FAVORITES_MAX)}
          </Typography>
        }
      />
      {favorites.length === 0 && !own ? (
        <Typography variant="body2" color="text.secondary">
          {t.noFavoritesOther}
        </Typography>
      ) : favorites.length === 0 ? (
        <>
          <Typography variant="body2" color="text.secondary">
            {t.noFavorites}
          </Typography>
          <Box
            component={RouterLink}
            to="/games"
            sx={{
              mt: 1.25,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              typography: 'body2',
              fontWeight: 700,
              color: 'primary.main',
              textDecoration: 'none',
              '& svg': { fontSize: 16 },
            }}
          >
            {t.goToLibrary}
            <ArrowForwardIcon aria-hidden />
          </Box>
        </>
      ) : (
        <Stack component="ol" spacing={0.25} sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {favorites.map((game, index) => (
            <Stack
              component="li"
              key={game.userGameId}
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center' }}
            >
              <Typography
                aria-hidden
                sx={{
                  width: 18,
                  flexShrink: 0,
                  textAlign: 'center',
                  fontWeight: 900,
                  color: alpha(FAVORITE_COLOR, 0.85),
                }}
              >
                {index + 1}
              </Typography>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <GameLink game={game} coverWidth={36} />
              </Box>
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  );
}

/** Right column of the profile: favorites and the standout games of the library. */
/**
 * Favorites and standout games: the current user's, or another player's
 * already loaded `highlights` whose games open at `gamePath`.
 */
export function ProfileHighlights({
  highlights,
  gamePath,
}: {
  highlights?: PlayerHighlights;
  gamePath?: (userGameId: string) => string;
} = {}) {
  const query = usePlayerHighlights(highlights === undefined);
  const context = useMemo(
    () =>
      gamePath
        ? { gamePath, own: false }
        : { gamePath: (userGameId: string) => `/games/${userGameId}`, own: true },
    [gamePath],
  );

  if (!highlights && query.isPending) {
    return (
      <Stack spacing={2} aria-busy="true" aria-label={messages.app.loading}>
        {[180, 120, 120, 120, 120].map((height, index) => (
          <Skeleton key={index} variant="rounded" height={height} sx={{ borderRadius: 3 }} />
        ))}
      </Stack>
    );
  }
  if (!highlights && query.isError) {
    return (
      <Alert severity="error" variant="outlined">
        {t.loadError}
      </Alert>
    );
  }

  const { favorites, mostPlayed, fastest, highestRated, lowestRated } = highlights ?? query.data!;
  const rating = messages.detail.ratingValue;
  return (
    <HighlightsContext.Provider value={context}>
      <Stack component="aside" aria-label={t.label} spacing={2}>
        <FavoritesPanel favorites={favorites} />
        <HighlightCard
          id="profile-most-played"
          title={t.mostPlayed}
          icon={<ScheduleIcon />}
          accent={() => VIOLET}
          game={mostPlayed}
          value={mostPlayed ? formatMinutes(mostPlayed.minutes) : undefined}
          empty={t.noMostPlayed}
        />
        <HighlightCard
          id="profile-fastest"
          title={t.fastest}
          icon={<BoltIcon />}
          accent={(theme) => theme.palette.info.main}
          game={fastest}
          value={fastest ? formatMinutes(fastest.minutes) : undefined}
          detail={
            fastest ? t.playthrough(fastest.playthroughNumber, fastest.playthroughName) : undefined
          }
          empty={t.noFastest}
        />
        <HighlightCard
          id="profile-highest-rated"
          title={t.highestRated}
          icon={<StarIcon />}
          accent={(theme) => theme.palette.secondary.main}
          game={highestRated}
          value={highestRated ? rating(highestRated.rating) : undefined}
          empty={t.noHighest}
        />
        <HighlightCard
          id="profile-lowest-rated"
          title={t.lowestRated}
          icon={<StarHalfIcon />}
          accent={(theme) => theme.palette.grey[400]}
          game={lowestRated}
          value={lowestRated ? rating(lowestRated.rating) : undefined}
          empty={t.noLowest}
        />
      </Stack>
    </HighlightsContext.Provider>
  );
}
