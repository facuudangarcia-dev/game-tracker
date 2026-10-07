import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditIcon from '@mui/icons-material/Edit';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import StarIcon from '@mui/icons-material/Star';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import TuneIcon from '@mui/icons-material/Tune';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { alpha, type Theme } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { type ReactNode, useState } from 'react';
import { genreName } from '../../../i18n/genres';
import { messages } from '../../../i18n/messages';
import { formatMinutes, formatYear } from '../../../lib/format';
import {
  ambientBackground,
  brandGradient,
  glassSx,
  reducedMotion,
  statusColor,
} from '../../../theme/brand';
import { useCatalogGame } from '../../catalog/queries';
import { GameCover } from '../../library/GameCover';
import type { UserGameDetails } from '../../library/types';
import { DIFFICULTIES_SECTION_ID, type OnDetailAction } from '../detailActions';

const t = messages.detail;

interface IndicatorProps {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  accent: (theme: Theme) => string;
}

/** One of the big glass indicators of the header (status, time, rating, platinum). */
function Indicator({ label, value, icon, accent }: IndicatorProps) {
  return (
    <Box
      sx={(theme) => ({
        ...glassSx(theme, 0.55),
        borderRadius: 2.5,
        px: { xs: 1.25, sm: 1.75 },
        py: { xs: 1.25, sm: 1.5 },
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
      })}
    >
      <Box
        aria-hidden
        sx={(theme) => ({
          width: { xs: 28, sm: 34 },
          height: { xs: 28, sm: 34 },
          flexShrink: 0,
          borderRadius: 1.75,
          display: 'grid',
          placeItems: 'center',
          color: accent(theme),
          bgcolor: alpha(accent(theme), 0.16),
          '& svg': { fontSize: 19 },
        })}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}
        >
          {label}
        </Typography>
        <Typography sx={{ fontWeight: 800, lineHeight: 1.25, overflowWrap: 'anywhere' }}>
          {value}
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * Header of "my game": the game's artwork behind its cover and title, four big
 * indicators of the user's progress and the main actions.
 */
export function DetailHeader({
  userGame,
  onAction,
}: {
  userGame: UserGameDetails;
  onAction: OnDetailAction;
}) {
  const { game } = userGame;
  const canLogSession = userGame.playthroughs.some((p) => p.timeMode === 'SESSIONS');
  const year = formatYear(game.releaseDate);
  const genres = game.genres.map(genreName);
  // The artwork comes from the catalog (manual games have none: their cover, blurred).
  const catalog = useCatalogGame(
    game.provider ?? '',
    game.externalId ?? '',
    Boolean(game.provider && game.externalId),
  );
  const artworkUrl = catalog.data?.artworkUrl ?? null;
  const backdrop = artworkUrl ?? game.coverUrl;
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  return (
    <Box
      component="header"
      aria-labelledby="game-title"
      sx={(theme) => ({
        position: 'relative',
        isolation: 'isolate',
        overflow: 'hidden',
        borderRadius: { xs: 3, md: 4 },
        border: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
        background: ambientBackground(theme),
        p: { xs: 2.5, sm: 4, md: 5 },
        pt: { xs: 14, sm: 16, md: 6 },
        boxShadow: `0 30px 80px -40px ${alpha(theme.palette.primary.main, 0.45)}`,
      })}
    >
      {backdrop ? (
        <Box
          key={backdrop}
          component="img"
          src={backdrop}
          alt=""
          aria-hidden
          onLoad={() => setLoadedSrc(backdrop)}
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: -2,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 25%',
            opacity: loadedSrc === backdrop ? 1 : 0,
            transition: 'opacity .8s ease',
            filter: artworkUrl ? 'none' : 'blur(28px) saturate(1.3)',
            transform: artworkUrl ? 'none' : 'scale(1.2)',
            [reducedMotion]: { transition: 'none' },
          }}
        />
      ) : null}
      <Box
        aria-hidden
        sx={(theme) => {
          const bg = theme.palette.background.default;
          return {
            position: 'absolute',
            inset: 0,
            zIndex: -1,
            background: {
              xs: `linear-gradient(0deg, ${bg} 45%, ${alpha(bg, 0.65)} 75%, ${alpha(bg, 0.15)} 100%)`,
              md: [
                `linear-gradient(90deg, ${alpha(bg, 0.96)} 0%, ${alpha(bg, 0.82)} 50%, ${alpha(bg, 0.3)} 100%)`,
                `linear-gradient(0deg, ${alpha(bg, 0.9)} 0%, transparent 55%)`,
              ].join(', '),
            },
          };
        }}
      />

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={{ xs: 2.5, sm: 4 }}
        sx={{ alignItems: { xs: 'flex-start', sm: 'flex-start' } }}
      >
        <Box
          sx={(theme) => ({
            flexShrink: 0,
            borderRadius: 2,
            overflow: 'hidden',
            boxShadow: `0 30px 60px -20px rgba(0,0,0,0.9), 0 0 0 1px ${alpha(theme.palette.common.white, 0.14)}`,
          })}
        >
          <GameCover
            src={game.coverUrl}
            name={game.name}
            width={{ xs: 120, sm: 170, md: 200 }}
            square
          />
        </Box>

        <Stack spacing={1.5} sx={{ minWidth: 0, flex: 1 }}>
          {year || genres.length > 0 ? (
            <Typography
              variant="overline"
              color="primary"
              sx={{ fontWeight: 800, letterSpacing: 1.8, lineHeight: 1.5 }}
            >
              {[year, ...genres.slice(0, 3)].filter(Boolean).join(' · ')}
            </Typography>
          ) : null}
          <Typography
            id="game-title"
            variant="h3"
            component="h1"
            sx={{
              fontWeight: 900,
              letterSpacing: { xs: -0.5, md: -1.2 },
              lineHeight: 1.05,
              fontSize: { xs: '1.9rem', sm: '2.4rem', md: '3rem' },
              overflowWrap: 'anywhere',
              textWrap: 'balance',
            }}
          >
            {game.name}
          </Typography>
          <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <Box
              component="span"
              sx={(theme) => ({
                px: 1.25,
                py: 0.35,
                borderRadius: 1.5,
                typography: 'body2',
                fontWeight: 800,
                color: 'primary.light',
                bgcolor: alpha(theme.palette.primary.main, 0.18),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.35)}`,
              })}
            >
              {userGame.platform.name}
            </Box>
            {game.developers.length > 0 ? (
              <Typography color="text.secondary" sx={{ fontWeight: 500 }}>
                {game.developers.join(', ')}
              </Typography>
            ) : null}
            {game.isManual ? (
              <Box
                component="span"
                sx={(theme) => ({
                  ...glassSx(theme, 0.5),
                  px: 1,
                  py: 0.2,
                  borderRadius: 1,
                  typography: 'caption',
                  fontWeight: 700,
                })}
              >
                {t.manualGame}
              </Box>
            ) : null}
          </Stack>

          {/* The four indicators of the user's progress with this game. */}
          <Box
            sx={{
              pt: 1,
              display: 'grid',
              gap: 1.25,
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(4, minmax(0, 1fr))',
              },
            }}
          >
            <Indicator
              label={t.myGame.status}
              value={messages.status[userGame.status]}
              accent={(theme) => statusColor(theme, userGame.status)}
              icon={
                <Box
                  sx={(theme) => ({
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: statusColor(theme, userGame.status),
                    boxShadow: `0 0 8px ${statusColor(theme, userGame.status)}`,
                  })}
                />
              }
            />
            <Indicator
              label={t.totalTime}
              value={formatMinutes(userGame.totalMinutes)}
              accent={(theme) => theme.palette.primary.main}
              icon={<TimerOutlinedIcon />}
            />
            <Indicator
              label={t.myGame.rating}
              value={userGame.rating === null ? t.noRating : t.ratingValue(userGame.rating)}
              accent={(theme) => theme.palette.secondary.main}
              icon={<StarIcon />}
            />
            <Indicator
              label={messages.library.platinumBadge}
              value={userGame.platinum.achieved ? t.platinum.achievedShort : t.platinum.notAchieved}
              accent={(theme) =>
                userGame.platinum.achieved ? theme.palette.secondary.main : theme.palette.grey[500]
              }
              icon={<EmojiEventsIcon />}
            />
          </Box>

          {game.summary ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                maxWidth: 760,
              }}
            >
              {game.summary}
            </Typography>
          ) : null}

          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', pt: 1 }}>
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={() => onAction({ type: 'editGame' })}
              sx={(theme) => ({
                fontWeight: 800,
                color: theme.palette.common.white,
                background: brandGradient(theme, 110),
                boxShadow: `0 12px 28px -12px ${alpha(theme.palette.primary.main, 0.9)}`,
                '&:hover': { background: brandGradient(theme, 110), filter: 'brightness(1.08)' },
              })}
            >
              {t.editGame}
            </Button>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => onAction({ type: 'newPlaythrough' })}
              sx={headerButtonSx}
            >
              {t.newPlaythrough}
            </Button>
            <Tooltip title={canLogSession ? '' : t.logSessionDisabled}>
              <Box component="span">
                <Button
                  variant="outlined"
                  startIcon={<TimerOutlinedIcon />}
                  disabled={!canLogSession}
                  onClick={() => onAction({ type: 'newSession' })}
                  sx={headerButtonSx}
                >
                  {t.logSession}
                </Button>
              </Box>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={<TuneIcon />}
              href={`#${DIFFICULTIES_SECTION_ID}`}
              sx={headerButtonSx}
            >
              {t.manageDifficulties}
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteOutlineIcon />}
              onClick={() => onAction({ type: 'deleteGame' })}
              sx={headerButtonSx}
            >
              {t.deleteGame}
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Box>
  );
}

/** Outlined buttons over artwork: a touch of glass so they stay readable. */
const headerButtonSx = (theme: Theme) => ({
  bgcolor: alpha(theme.palette.background.default, 0.45),
  backdropFilter: 'blur(6px)',
});
