import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditIcon from '@mui/icons-material/Edit';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
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
        <List disablePadding>
          {userGame.sessions.map((session) => {
            const when = formatDateTime(session.playedAt);
            return (
              <ListItem
                key={session.id}
                divider
                disableGutters
                secondaryAction={
                  <Stack direction="row">
                    <IconButton
                      aria-label={t.edit(when)}
                      onClick={() => onAction({ type: 'editSession', session })}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      aria-label={t.delete(when)}
                      color="error"
                      onClick={() => onAction({ type: 'deleteSession', session })}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </Stack>
                }
                sx={{ pr: 12 }}
              >
                <ListItemText
                  primary={
                    <Stack
                      direction="row"
                      spacing={1}
                      useFlexGap
                      sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                    >
                      <span>{when}</span>
                      <Typography component="span" sx={{ fontWeight: 700 }}>
                        {formatMinutes(session.durationMinutes)}
                      </Typography>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t.ofPlaythrough(session.playthroughNumber)}
                      />
                      {!session.countsTowardTime ? (
                        <Chip
                          size="small"
                          color="warning"
                          variant="outlined"
                          label={t.notCounted}
                        />
                      ) : null}
                    </Stack>
                  }
                  secondary={session.notes}
                  slotProps={{
                    secondary: { sx: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } },
                  }}
                />
              </ListItem>
            );
          })}
        </List>
      )}
    </Section>
  );
}
