import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { Link as RouterLink, useParams } from 'react-router';
import { catalogGamePath } from '../features/catalog/queries';
import { GameCover } from '../features/library/GameCover';
import { StatusChip } from '../features/library/StatusChip';
import type { Achievement } from '../features/library/types';
import { usePlayerGame } from '../features/social/api';
import { playerPath } from '../features/social/paths';
import { useLocale } from '../i18n/locale';
import { messages } from '../i18n/messages';
import { formatDate, formatMinutes } from '../lib/format';
import { panelSx, VIOLET } from '../theme/brand';

const t = messages.social.player;
const d = messages.detail;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase' }}
      >
        {label}
      </Typography>
      <Box sx={{ fontWeight: 700 }}>{children}</Box>
    </Box>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box
      component="section"
      aria-label={title}
      sx={(theme) => ({ ...panelSx(theme), p: { xs: 2, md: 2.5 } })}
    >
      <Typography variant="h6" component="h2" sx={{ fontWeight: 800, mb: 1.5 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function achievementName(achievement: Achievement, locale: string) {
  return (locale === 'es' && achievement.nameEs) || achievement.name;
}

/**
 * A friend's game, read-only (decision #85): status, time, rating, platinum,
 * playthroughs, notes and achievements. Nothing can be changed here.
 */
export function PlayerGamePage() {
  const { username = '', userGameId = '' } = useParams();
  const game = usePlayerGame(username, userGameId);
  const locale = useLocale();
  const back = (
    <Button
      component={RouterLink}
      to={playerPath(username)}
      startIcon={<ArrowBackIcon />}
      sx={{ alignSelf: 'flex-start' }}
    >
      {t.backToProfile(username)}
    </Button>
  );

  if (game.isPending) {
    return <Skeleton variant="rounded" height={320} sx={{ borderRadius: 4 }} />;
  }
  if (game.isError) {
    return (
      <Stack spacing={2} sx={{ maxWidth: 720, mx: 'auto' }}>
        {back}
        <Alert severity="warning" variant="outlined">
          {t.gameNotFound}
        </Alert>
      </Stack>
    );
  }

  const data = game.data;
  const achieved = data.achievementList.filter((a) => a.achieved).length;
  const total = data.achievementList.length;
  const notesByPlaythrough = data.playthroughs.filter((p) => p.notes);
  return (
    <Stack spacing={3} sx={{ maxWidth: 980, mx: 'auto' }}>
      {back}
      <Box
        component="section"
        aria-labelledby="player-game-title"
        sx={(theme) => ({
          ...panelSx(theme),
          p: { xs: 2.5, md: 3 },
          display: 'flex',
          gap: 3,
          flexDirection: { xs: 'column', sm: 'row' },
        })}
      >
        <Box
          sx={{
            width: { xs: 140, sm: 170 },
            flexShrink: 0,
            alignSelf: { xs: 'center', sm: 'flex-start' },
          }}
        >
          <GameCover src={data.game.coverUrl} name={data.game.name} />
        </Box>
        <Stack spacing={2} sx={{ minWidth: 0, flex: 1 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              {t.readOnly(username)}
            </Typography>
            <Typography
              id="player-game-title"
              variant="h4"
              component="h1"
              sx={{ fontWeight: 900, overflowWrap: 'anywhere' }}
            >
              {data.game.provider && data.game.externalId ? (
                <Link
                  component={RouterLink}
                  to={catalogGamePath(data.game.provider, data.game.externalId)}
                  color="inherit"
                  underline="hover"
                >
                  {data.game.name}
                </Link>
              ) : (
                data.game.name
              )}
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(4, minmax(0, 1fr))',
              },
            }}
          >
            <Field label={d.myGame.platform}>{data.platform.shortName}</Field>
            <Field label={d.myGame.status}>
              <StatusChip status={data.status} />
            </Field>
            <Field label={d.myGame.totalTime}>{formatMinutes(data.totalMinutes)}</Field>
            <Field label={d.myGame.rating}>
              {data.rating !== null ? d.ratingValue(data.rating) : d.noRating}
            </Field>
          </Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <EmojiEventsIcon
              sx={{ color: data.platinum.achieved ? 'secondary.main' : 'text.disabled' }}
              aria-hidden
            />
            <Typography sx={{ fontWeight: 700 }}>
              {data.platinum.achieved
                ? `${d.platinum.achieved}${data.platinum.date ? ` · ${formatDate(data.platinum.date)}` : ''}${
                    data.platinum.timeMinutes
                      ? ` · ${formatMinutes(data.platinum.timeMinutes)}`
                      : ''
                  }`
                : d.platinum.notAchieved}
            </Typography>
          </Stack>
        </Stack>
      </Box>

      <Panel title={t.playthroughs}>
        <Stack spacing={1.5}>
          {data.playthroughs.map((playthrough) => (
            <Box
              key={playthrough.id}
              sx={(theme) => ({
                p: 1.5,
                borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`,
              })}
            >
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 1 }}
              >
                <Typography sx={{ fontWeight: 800 }}>
                  {d.playthroughs.title(playthrough.number)}
                  {playthrough.name ? ` · ${playthrough.name}` : ''}
                </Typography>
                <StatusChip status={playthrough.status} />
              </Stack>
              <Box
                sx={{
                  display: 'grid',
                  gap: 1.5,
                  gridTemplateColumns: {
                    xs: 'repeat(2, minmax(0, 1fr))',
                    md: 'repeat(4, minmax(0, 1fr))',
                  },
                }}
              >
                <Field label={d.playthroughs.time}>{formatMinutes(playthrough.minutes)}</Field>
                <Field label={d.playthroughs.difficulty}>
                  {playthrough.difficulty?.name ?? d.playthroughs.noDifficulty}
                </Field>
                <Field label={d.playthroughs.startDate}>
                  {playthrough.startDate
                    ? formatDate(playthrough.startDate)
                    : messages.common.notSet}
                </Field>
                <Field label={d.playthroughs.completionDate}>
                  {playthrough.completionDate
                    ? formatDate(playthrough.completionDate)
                    : messages.common.notSet}
                </Field>
              </Box>
            </Box>
          ))}
        </Stack>
      </Panel>

      <Panel title={t.notes}>
        {data.notes || notesByPlaythrough.length ? (
          <Stack spacing={1.5}>
            {data.notes ? (
              <Typography sx={{ whiteSpace: 'pre-line' }}>{data.notes}</Typography>
            ) : null}
            {notesByPlaythrough.map((playthrough) => (
              <Box key={playthrough.id}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                  {d.playthroughs.title(playthrough.number)}
                </Typography>
                <Typography sx={{ whiteSpace: 'pre-line' }}>{playthrough.notes}</Typography>
              </Box>
            ))}
          </Stack>
        ) : (
          <Typography color="text.secondary">{t.noNotes}</Typography>
        )}
      </Panel>

      {total ? (
        <Panel title={t.achievements}>
          <Typography sx={{ fontWeight: 800 }}>
            {d.achievements.progress(achieved, total)} ·{' '}
            {d.achievements.percent(Math.round((achieved / total) * 100))}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={(achieved / total) * 100}
            sx={{
              my: 1.5,
              height: 8,
              borderRadius: 99,
              '& .MuiLinearProgress-bar': { bgcolor: VIOLET },
            }}
          />
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
            {data.achievementList.map((achievement) => {
              // Hidden achievements keep their secret until unlocked.
              const name =
                achievement.hidden && !achievement.achieved
                  ? d.achievements.hidden
                  : achievementName(achievement, locale);
              return (
                <Chip
                  key={achievement.id}
                  label={name}
                  size="small"
                  variant={achievement.achieved ? 'filled' : 'outlined'}
                  icon={
                    achievement.achieved ? (
                      <CheckCircleIcon sx={{ color: `${VIOLET} !important` }} />
                    ) : (
                      <RadioButtonUncheckedIcon />
                    )
                  }
                />
              );
            })}
          </Stack>
        </Panel>
      ) : null}
    </Stack>
  );
}
