import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditIcon from '@mui/icons-material/Edit';
import FlagIcon from '@mui/icons-material/Flag';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { Section } from '../../../components/Section';
import { messages } from '../../../i18n/messages';
import { formatDateTime } from '../../../lib/dates';
import { formatDate, formatMinutes } from '../../../lib/format';
import { gradientTextSx, ink, statusColor } from '../../../theme/brand';
import { StatusChip } from '../../library/StatusChip';
import type { GamingSession, Playthrough, UserGameDetails } from '../../library/types';
import type { OnDetailAction } from '../detailActions';
import { Facts } from './MyGameSection';
import { PlaythroughDifficulty, PlaythroughTimeBox } from './PlaythroughInlineEdit';

const t = messages.detail.playthroughs;
const ts = messages.detail.sessions;

/** One entry of the playthrough's timeline: a dot, then its content. */
function TimelineItem({
  last,
  hollow = false,
  children,
}: {
  last: boolean;
  hollow?: boolean;
  children: ReactNode;
}) {
  return (
    <Box component="li" sx={{ display: 'flex', gap: 1.5, pb: last ? 0 : 1.75 }}>
      <Box
        aria-hidden
        sx={(theme) => ({
          position: 'relative',
          flexShrink: 0,
          width: 12,
          display: 'flex',
          justifyContent: 'center',
          pt: 0.85,
          '&::after': last
            ? undefined
            : {
                content: '""',
                position: 'absolute',
                top: 22,
                bottom: -8,
                width: 2,
                bgcolor: alpha(theme.palette.info.main, 0.22),
              },
        })}
      >
        <Box
          sx={(theme) => ({
            width: 10,
            height: 10,
            borderRadius: '50%',
            ...(hollow
              ? { border: `2px solid ${alpha(ink(theme), 0.35)}` }
              : {
                  bgcolor: theme.palette.info.main,
                  boxShadow: `0 0 8px ${alpha(theme.palette.info.main, 0.8)}`,
                }),
          })}
        />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

function DurationPill({ minutes }: { minutes: number }) {
  return (
    <Typography
      component="span"
      sx={(theme) => ({
        px: 1,
        borderRadius: 1,
        fontWeight: 800,
        whiteSpace: 'nowrap',
        bgcolor: alpha(theme.palette.info.main, 0.14),
        color: 'info.light',
      })}
    >
      {formatMinutes(minutes)}
    </Typography>
  );
}

/** The sessions of one playthrough (most recent first), then its previous time if any. */
function PlaythroughSessions({
  playthrough,
  sessions,
  onAction,
}: {
  playthrough: Playthrough;
  sessions: GamingSession[];
  onAction: OnDetailAction;
}) {
  const hasPrevious = playthrough.previousMinutes > 0;
  const headingId = `playthrough-${playthrough.id}-sessions`;

  return (
    <Box
      sx={(theme) => ({
        mt: 2,
        pt: 2,
        borderTop: `1px solid ${alpha(ink(theme), 0.07)}`,
      })}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.25, flexWrap: 'wrap' }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
          <Typography
            id={headingId}
            variant="overline"
            component="h4"
            sx={{ fontWeight: 800, letterSpacing: 1.4, color: 'text.secondary', lineHeight: 1.6 }}
          >
            {t.sessions}
          </Typography>
          {sessions.length > 0 ? (
            <Typography variant="caption" color="text.secondary">
              {t.sessionCount(sessions.length)}
            </Typography>
          ) : null}
        </Stack>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          aria-label={t.addSessionTo(playthrough.number)}
          onClick={() => onAction({ type: 'newSession', playthroughId: playthrough.id })}
          sx={(theme) => ({
            borderRadius: 99,
            borderColor: alpha(theme.palette.info.main, 0.45),
            color: 'info.light',
            '&:hover': {
              borderColor: theme.palette.info.main,
              bgcolor: alpha(theme.palette.info.main, 0.08),
            },
          })}
        >
          {t.addSession}
        </Button>
      </Stack>

      {sessions.length === 0 && !hasPrevious ? (
        <Typography variant="body2" color="text.secondary">
          {t.noSessions}
        </Typography>
      ) : (
        <Box component="ul" aria-labelledby={headingId} sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {sessions.map((session, index) => {
            const when = formatDateTime(session.playedAt);
            return (
              <TimelineItem key={session.id} last={index === sessions.length - 1 && !hasPrevious}>
                <Stack
                  direction="row"
                  spacing={1}
                  useFlexGap
                  sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                >
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                    {when}
                  </Typography>
                  <DurationPill minutes={session.durationMinutes} />
                  <Box sx={{ flex: 1 }} />
                  <IconButton
                    size="small"
                    aria-label={ts.edit(when)}
                    onClick={() => onAction({ type: 'editSession', session })}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label={ts.delete(when)}
                    color="error"
                    onClick={() => onAction({ type: 'deleteSession', session })}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
                {session.notes ? (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.25, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                  >
                    {session.notes}
                  </Typography>
                ) : null}
              </TimelineItem>
            );
          })}
          {hasPrevious ? (
            <TimelineItem last hollow>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {t.previousLabel}
                </Typography>
                <DurationPill minutes={playthrough.previousMinutes} />
              </Stack>
            </TimelineItem>
          ) : null}
        </Box>
      )}
    </Box>
  );
}

function PlaythroughCard({
  userGame,
  playthrough,
  sessions,
  onAction,
}: {
  userGame: UserGameDetails;
  playthrough: Playthrough;
  sessions: GamingSession[];
  onAction: OnDetailAction;
}) {
  const isFirst = playthrough.number === 1;

  return (
    <Box
      component="article"
      aria-label={t.title(playthrough.number)}
      sx={(theme) => ({
        p: { xs: 2, md: 2.5 },
        pl: { xs: 2.5, md: 3 },
        borderRadius: 2.5,
        bgcolor: alpha(ink(theme), 0.025),
        border: `1px solid ${alpha(ink(theme), 0.07)}`,
        // The status color as an edge on the left.
        boxShadow: `inset 3px 0 0 ${statusColor(theme, playthrough.status)}`,
      })}
    >
      <Stack
        direction="row"
        spacing={1.25}
        sx={{ alignItems: 'center', mb: 2, flexWrap: 'wrap', rowGap: 1 }}
      >
        <Typography
          aria-hidden
          sx={(theme) => ({
            fontSize: '1.6rem',
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: -1,
            ...gradientTextSx(theme),
          })}
        >
          #{playthrough.number}
        </Typography>
        <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 800 }}>
          {t.title(playthrough.number)}
          {playthrough.name ? ` — ${playthrough.name}` : ''}
        </Typography>
        <StatusChip status={playthrough.status} />
        <Box sx={{ flex: 1 }} />
        <Tooltip title={t.edit(playthrough.number)}>
          <IconButton
            aria-label={t.edit(playthrough.number)}
            onClick={() => onAction({ type: 'editPlaythrough', playthrough })}
          >
            <EditIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title={isFirst ? t.firstNotDeletable : t.delete(playthrough.number)}>
          <Box component="span">
            <IconButton
              aria-label={t.delete(playthrough.number)}
              disabled={isFirst}
              color="error"
              onClick={() => onAction({ type: 'deletePlaythrough', playthrough })}
            >
              <DeleteOutlineIcon />
            </IconButton>
          </Box>
        </Tooltip>
      </Stack>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2.5}
        sx={{ alignItems: { sm: 'flex-start' } }}
      >
        {/* The playthrough's time, computed from its sessions (and previous time). */}
        <PlaythroughTimeBox userGame={userGame} playthrough={playthrough} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Facts
            items={[
              [
                t.difficulty,
                <PlaythroughDifficulty
                  key="difficulty"
                  userGame={userGame}
                  playthrough={playthrough}
                />,
              ],
              [t.startDate, formatDate(playthrough.startDate)],
              [t.completionDate, formatDate(playthrough.completionDate)],
            ]}
          />
        </Box>
      </Stack>

      {playthrough.notes ? (
        <Typography
          variant="body2"
          sx={(theme) => ({
            mt: 2,
            pl: 1.5,
            borderLeft: `2px solid ${alpha(theme.palette.primary.main, 0.5)}`,
            fontStyle: 'italic',
            color: 'text.secondary',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
          })}
        >
          {playthrough.notes}
        </Typography>
      ) : null}

      <PlaythroughSessions playthrough={playthrough} sessions={sessions} onAction={onAction} />
    </Box>
  );
}

/**
 * Playthroughs with their sessions inside: every session belongs to a
 * playthrough and adds its duration to that playthrough's time.
 */
export function PlaythroughsSection({
  userGame,
  onAction,
}: {
  userGame: UserGameDetails;
  onAction: OnDetailAction;
}) {
  return (
    <Section
      id="partidas"
      title={messages.detail.sections.playthroughs}
      icon={<FlagIcon />}
      actions={
        <Button startIcon={<AddIcon />} onClick={() => onAction({ type: 'newPlaythrough' })}>
          {messages.detail.newPlaythrough}
        </Button>
      }
    >
      <Stack spacing={1.75}>
        {userGame.playthroughs.map((playthrough) => (
          <PlaythroughCard
            key={playthrough.id}
            userGame={userGame}
            playthrough={playthrough}
            sessions={userGame.sessions.filter((s) => s.playthroughId === playthrough.id)}
            onAction={onAction}
          />
        ))}
      </Stack>
    </Section>
  );
}
