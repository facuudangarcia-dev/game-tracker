import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import ScheduleIcon from '@mui/icons-material/Schedule';
import StarIcon from '@mui/icons-material/Star';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router';
import { messages } from '../../i18n/messages';
import { formatMinutes } from '../../lib/format';
import { glassSx, ink, reducedMotion, statusColor } from '../../theme/brand';
import { DifficultyBadge } from './DifficultyBadge';
import { FavoriteButton } from './FavoriteButton';
import { GameCover } from './GameCover';
import type { UserGameListItem } from './types';
import { DarkSurface } from '../../theme/DarkSurface';

/**
 * Poster card of a library game: the cover fills the card, with the status on top
 * and name, platform, time and rating over a dark veil at the bottom.
 */
export function LibraryCard({
  item,
  to = `/games/${item.id}`,
  readOnly = false,
}: {
  item: UserGameListItem;
  /** Where the card leads (a friend's game opens in their profile). */
  to?: string;
  /** Someone else's game: no favorite button. */
  readOnly?: boolean;
}) {
  return (
    <DarkSurface>
      <Box
        component="article"
        aria-label={item.game.name}
        sx={{ height: '100%', position: 'relative' }}
      >
        <Box
          component={RouterLink}
          to={to}
          aria-label={messages.library.openGame(`${item.game.name} (${item.platform.shortName})`)}
          sx={(theme) => ({
            position: 'relative',
            display: 'block',
            height: '100%',
            color: 'inherit',
            textDecoration: 'none',
            borderRadius: 2.5,
            overflow: 'hidden',
            isolation: 'isolate',
            border: `1px solid ${alpha(ink(theme), 0.06)}`,
            bgcolor: 'background.paper',
            transition: 'transform .25s ease, box-shadow .25s ease',
            outlineOffset: 3,
            '& img': { transition: 'transform .4s ease' },
            '&:hover, &:focus-visible': {
              transform: 'translateY(-6px)',
              boxShadow: `0 18px 40px -18px ${alpha(theme.palette.primary.main, 0.8)}, 0 0 0 1px ${alpha(theme.palette.primary.main, 0.6)}`,
            },
            '&:hover img, &:focus-visible img': { transform: 'scale(1.05)' },
            [reducedMotion]: {
              transition: 'none',
              '& img': { transition: 'none' },
              '&:hover, &:hover img': { transform: 'none' },
            },
          })}
        >
          <GameCover src={item.game.coverUrl} name={item.game.name} square />

          {/* Veil for the overlaid text. */}
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(0deg, rgba(8,10,14,0.98) 0%, rgba(8,10,14,0.88) 34%, rgba(8,10,14,0.35) 58%, transparent 72%)',
              pointerEvents: 'none',
            }}
          />

          <Stack
            direction="row"
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              right: 8,
              justifyContent: 'space-between',
            }}
          >
            <Box
              sx={(theme) => ({
                ...glassSx(theme, 0.6),
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1,
                py: 0.25,
                borderRadius: 99,
                typography: 'caption',
                fontWeight: 700,
                lineHeight: 1.6,
              })}
            >
              <Box
                aria-hidden
                sx={(theme) => ({
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  bgcolor: statusColor(theme, item.status),
                  boxShadow: `0 0 6px ${statusColor(theme, item.status)}`,
                })}
              />
              {messages.status[item.status]}
            </Box>
            {item.platinumAchieved ? (
              <Box
                role="img"
                aria-label={messages.library.platinumBadge}
                title={messages.library.platinumBadge}
                sx={(theme) => ({
                  // Leaves room for the favorite button, which sits outside the link.
                  mr: '38px',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: 'secondary.main',
                  color: 'secondary.contrastText',
                  boxShadow: `0 0 14px ${alpha(theme.palette.secondary.main, 0.8)}`,
                })}
              >
                <EmojiEventsIcon sx={{ fontSize: 17 }} />
              </Box>
            ) : null}
          </Stack>

          <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, p: 1.5 }}>
            <Typography
              variant="subtitle2"
              component="h2"
              title={item.game.name}
              sx={{
                fontWeight: 800,
                lineHeight: 1.25,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {item.game.name}
            </Typography>
            {item.steam && item.game.isManual ? (
              <Typography
                variant="caption"
                color="text.secondary"
                component="p"
                sx={{ fontStyle: 'italic', lineHeight: 1.3 }}
              >
                {messages.library.notInCatalog}
              </Typography>
            ) : null}
            <Stack
              direction="row"
              sx={{ mt: 0.75, alignItems: 'center', justifyContent: 'space-between', gap: 1 }}
            >
              <Typography
                variant="caption"
                sx={{
                  px: 0.75,
                  borderRadius: 1,
                  fontWeight: 700,
                  letterSpacing: 0.3,
                  color: 'primary.light',
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.16),
                  whiteSpace: 'nowrap',
                }}
              >
                {item.platform.shortName}
              </Typography>
              {item.rating === null ? (
                <Typography variant="caption" color="text.secondary" noWrap>
                  {messages.detail.noRating}
                </Typography>
              ) : (
                <Stack
                  direction="row"
                  spacing={0.25}
                  sx={{ alignItems: 'center', color: 'secondary.main' }}
                >
                  <StarIcon aria-hidden sx={{ fontSize: 15 }} />
                  <Typography variant="caption" sx={{ fontWeight: 800 }}>
                    {messages.detail.ratingValue(item.rating)}
                  </Typography>
                </Stack>
              )}
            </Stack>
            <Stack
              direction="row"
              sx={{
                mt: 0.5,
                alignItems: 'center',
                justifyContent: 'space-between',
                columnGap: 1,
                rowGap: 0.5,
                // On narrow cards the difficulty goes to its own line instead of being cut.
                flexWrap: 'wrap',
              }}
            >
              <Stack
                direction="row"
                spacing={0.5}
                sx={{ alignItems: 'center', color: 'text.secondary', flexShrink: 0 }}
              >
                <ScheduleIcon aria-hidden sx={{ fontSize: 14 }} />
                <Typography variant="caption">{formatMinutes(item.totalMinutes)}</Typography>
              </Stack>
              {item.achievements ? (
                <Stack
                  direction="row"
                  spacing={0.25}
                  role="img"
                  aria-label={messages.library.achievementsCount(
                    item.achievements.achieved,
                    item.achievements.total,
                  )}
                  sx={{ alignItems: 'center', color: 'text.secondary', flexShrink: 0 }}
                >
                  <MilitaryTechIcon aria-hidden sx={{ fontSize: 15 }} />
                  <Typography variant="caption" aria-hidden>
                    {item.achievements.achieved}/{item.achievements.total}
                  </Typography>
                </Stack>
              ) : null}
              {item.difficulty ? (
                <Box sx={{ maxWidth: '100%', display: 'flex' }}>
                  <DifficultyBadge {...item.difficulty} size="small" />
                </Box>
              ) : null}
            </Stack>
          </Box>
        </Box>
        {/* Outside the link: a button can't be nested in an anchor. */}
        {readOnly ? null : (
          <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
            <FavoriteButton
              userGameId={item.id}
              name={item.game.name}
              favorite={item.favorite}
              variant="card"
            />
          </Box>
        )}
      </Box>
    </DarkSurface>
  );
}
