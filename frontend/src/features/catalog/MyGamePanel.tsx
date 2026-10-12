import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ScheduleIcon from '@mui/icons-material/Schedule';
import StarIcon from '@mui/icons-material/Star';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router';
import { messages } from '../../i18n/messages';
import { formatMinutes } from '../../lib/format';
import { ink, panelSx, statusColor } from '../../theme/brand';
import type { LibraryEntry } from '../library/types';

const t = messages.catalog;

/** The user's own progress with this game, one row per platform they have it on. */
export function MyGamePanel({ entries }: { entries: LibraryEntry[] }) {
  return (
    <Box
      component="section"
      aria-labelledby="catalog-my-game"
      sx={(theme) => ({ ...panelSx(theme, theme.palette.success.main), p: { xs: 2.5, md: 3 } })}
    >
      <Typography
        id="catalog-my-game"
        variant="overline"
        component="h2"
        sx={{ fontWeight: 800, letterSpacing: 1.8, color: 'success.main' }}
      >
        {t.myGame}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t.myGameHint}
      </Typography>
      <Stack spacing={1.25} sx={{ mt: 2 }}>
        {entries.map((entry) => (
          <Box
            key={entry.userGameId}
            sx={(theme) => ({
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: { xs: 1.25, sm: 2 },
              p: 1.5,
              borderRadius: 2,
              bgcolor: alpha(ink(theme), 0.03),
              border: `1px solid ${alpha(ink(theme), 0.07)}`,
            })}
          >
            <Typography
              variant="body2"
              sx={(theme) => ({
                px: 1,
                py: 0.25,
                borderRadius: 1,
                fontWeight: 800,
                color: 'primary.light',
                bgcolor: alpha(theme.palette.primary.main, 0.16),
              })}
            >
              {entry.platform.shortName}
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              <Box
                aria-hidden
                sx={(theme) => ({
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: statusColor(theme, entry.status),
                  boxShadow: `0 0 6px ${statusColor(theme, entry.status)}`,
                })}
              />
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {messages.status[entry.status]}
              </Typography>
            </Stack>
            <Stack
              direction="row"
              spacing={0.5}
              sx={{ alignItems: 'center', color: 'text.secondary' }}
            >
              <ScheduleIcon aria-hidden sx={{ fontSize: 16 }} />
              <Typography variant="body2">{formatMinutes(entry.totalMinutes)}</Typography>
            </Stack>
            {entry.rating === null ? (
              <Typography variant="body2" color="text.secondary">
                {messages.detail.noRating}
              </Typography>
            ) : (
              <Stack
                direction="row"
                spacing={0.25}
                sx={{ alignItems: 'center', color: 'secondary.main' }}
              >
                <StarIcon aria-hidden sx={{ fontSize: 16 }} />
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  {messages.detail.ratingValue(entry.rating)}
                </Typography>
              </Stack>
            )}
            {entry.platinumAchieved ? (
              <EmojiEventsIcon
                titleAccess={messages.library.platinumBadge}
                sx={(theme) => ({
                  fontSize: 20,
                  color: 'secondary.main',
                  filter: `drop-shadow(0 0 6px ${alpha(theme.palette.secondary.main, 0.8)})`,
                })}
              />
            ) : null}
            <Button
              size="small"
              variant="outlined"
              color="success"
              endIcon={<ArrowForwardIcon />}
              component={RouterLink}
              to={`/games/${entry.userGameId}`}
              sx={{ ml: { sm: 'auto' } }}
            >
              {t.viewMyGame(entry.platform.shortName)}
            </Button>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
