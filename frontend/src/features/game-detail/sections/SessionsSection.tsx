import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditIcon from '@mui/icons-material/Edit';
import ScheduleIcon from '@mui/icons-material/Schedule';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { Section } from '../../../components/Section';
import { messages } from '../../../i18n/messages';
import { formatDateTime } from '../../../lib/dates';
import { formatMinutes } from '../../../lib/format';
import type { UserGameDetails } from '../../library/types';
import type { OnDetailAction } from '../detailActions';

const t = messages.detail.sessions;

/** All sessions of the game; sessions of MANUAL playthroughs are kept but marked as not counted. */
export function SessionsSection({
  userGame,
  onAction,
}: {
  userGame: UserGameDetails;
  onAction: OnDetailAction;
}) {
  const canLogSession = userGame.playthroughs.some((p) => p.timeMode === 'SESSIONS');

  return (
    <Section
      id="sesiones"
      title={messages.detail.sections.sessions}
      icon={<ScheduleIcon />}
      accent={(theme) => theme.palette.info.main}
      actions={
        <Tooltip title={canLogSession ? '' : messages.detail.logSessionDisabled}>
          <Box component="span">
            <Button
              startIcon={<TimerOutlinedIcon />}
              disabled={!canLogSession}
              onClick={() => onAction({ type: 'newSession' })}
            >
              {messages.detail.logSession}
            </Button>
          </Box>
        </Tooltip>
      }
    >
      {userGame.sessions.length === 0 ? (
        <Typography color="text.secondary">{t.empty}</Typography>
      ) : (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {userGame.sessions.map((session, index) => {
            const when = formatDateTime(session.playedAt);
            const last = index === userGame.sessions.length - 1;
            return (
              <Box
                component="li"
                key={session.id}
                sx={{ display: 'flex', gap: 1.75, position: 'relative', pb: last ? 0 : 2 }}
              >
                {/* Timeline: a dot per session joined by a line. */}
                <Box
                  aria-hidden
                  sx={(theme) => ({
                    position: 'relative',
                    flexShrink: 0,
                    width: 12,
                    display: 'flex',
                    justifyContent: 'center',
                    pt: 0.75,
                    '&::after': last
                      ? undefined
                      : {
                          content: '""',
                          position: 'absolute',
                          top: 22,
                          bottom: -6,
                          width: 2,
                          bgcolor: alpha(theme.palette.info.main, 0.25),
                        },
                  })}
                >
                  <Box
                    sx={(theme) => ({
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      bgcolor: session.countsTowardTime
                        ? theme.palette.info.main
                        : theme.palette.grey[600],
                      boxShadow: session.countsTowardTime
                        ? `0 0 8px ${theme.palette.info.main}`
                        : 'none',
                    })}
                  />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    useFlexGap
                    sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                  >
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                      {when}
                    </Typography>
                    <Typography
                      component="span"
                      sx={(theme) => ({
                        px: 1,
                        borderRadius: 1,
                        fontWeight: 800,
                        bgcolor: alpha(theme.palette.info.main, 0.14),
                        color: 'info.light',
                      })}
                    >
                      {formatMinutes(session.durationMinutes)}
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t.ofPlaythrough(session.playthroughNumber)}
                    />
                    {!session.countsTowardTime ? (
                      <Chip size="small" color="warning" variant="outlined" label={t.notCounted} />
                    ) : null}
                    <Box sx={{ flex: 1 }} />
                    <IconButton
                      size="small"
                      aria-label={t.edit(when)}
                      onClick={() => onAction({ type: 'editSession', session })}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={t.delete(when)}
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
                      sx={{ mt: 0.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                    >
                      {session.notes}
                    </Typography>
                  ) : null}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Section>
  );
}
