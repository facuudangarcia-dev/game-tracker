import EditIcon from '@mui/icons-material/Edit';
import EditNoteIcon from '@mui/icons-material/EditNote';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { Section } from '../../../components/Section';
import { messages } from '../../../i18n/messages';
import { formatDateTime } from '../../../lib/dates';
import type { UserGameDetails } from '../../library/types';
import type { OnDetailAction } from '../detailActions';

const t = messages.detail.notes;

function NoteText({ children }: { children: string }) {
  return (
    <Typography
      variant="body2"
      sx={(theme) => ({
        pl: 1.5,
        borderLeft: `2px solid ${alpha(theme.palette.secondary.main, 0.55)}`,
        fontStyle: 'italic',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
      })}
    >
      {children}
    </Typography>
  );
}

function NoteGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box>
      <Typography
        variant="overline"
        component="h3"
        sx={{
          display: 'block',
          fontWeight: 800,
          letterSpacing: 1.4,
          color: 'text.secondary',
          mb: 0.75,
        }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  );
}

/** The three note levels (plain text): game, playthroughs and sessions. */
export function NotesSection({
  userGame,
  onAction,
}: {
  userGame: UserGameDetails;
  onAction: OnDetailAction;
}) {
  const playthroughNotes = userGame.playthroughs.filter((p) => p.notes);
  const sessionNotes = userGame.sessions.filter((s) => s.notes);

  return (
    <Section
      id="notas"
      title={messages.detail.sections.notes}
      icon={<EditNoteIcon />}
      accent={(theme) => theme.palette.secondary.main}
    >
      <Stack spacing={3}>
        <NoteGroup title={t.general}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
            <Box sx={{ flex: 1 }}>
              {userGame.notes ? (
                <NoteText>{userGame.notes}</NoteText>
              ) : (
                <Typography color="text.secondary">{t.none}</Typography>
              )}
            </Box>
            <Button
              size="small"
              startIcon={<EditIcon />}
              onClick={() => onAction({ type: 'editGame' })}
            >
              {t.editGeneral}
            </Button>
          </Stack>
        </NoteGroup>

        <NoteGroup title={t.playthroughs}>
          {playthroughNotes.length === 0 ? (
            <Typography color="text.secondary">{t.none}</Typography>
          ) : (
            <Stack spacing={1.5}>
              {playthroughNotes.map((playthrough) => (
                <Stack
                  key={playthrough.id}
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: 'flex-start' }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {messages.detail.playthroughs.title(playthrough.number)}
                    </Typography>
                    <NoteText>{playthrough.notes!}</NoteText>
                  </Box>
                  <IconButton
                    size="small"
                    aria-label={messages.detail.playthroughs.edit(playthrough.number)}
                    onClick={() => onAction({ type: 'editPlaythrough', playthrough })}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          )}
        </NoteGroup>

        <NoteGroup title={t.sessions}>
          {sessionNotes.length === 0 ? (
            <Typography color="text.secondary">{t.none}</Typography>
          ) : (
            <Stack spacing={1.5}>
              {sessionNotes.map((session) => {
                const when = formatDateTime(session.playedAt);
                return (
                  <Stack
                    key={session.id}
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: 'flex-start' }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        {`${when} · ${messages.detail.sessions.ofPlaythrough(session.playthroughNumber)}`}
                      </Typography>
                      <NoteText>{session.notes!}</NoteText>
                    </Box>
                    <IconButton
                      size="small"
                      aria-label={messages.detail.sessions.edit(when)}
                      onClick={() => onAction({ type: 'editSession', session })}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                );
              })}
            </Stack>
          )}
        </NoteGroup>
      </Stack>
    </Section>
  );
}
