import Alert from '@mui/material/Alert';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { durationFromMinutes } from '../../../components/duration';
import { DurationFields } from '../../../components/DurationFields';
import { FormDialog } from '../../../components/FormDialog';
import { messages } from '../../../i18n/messages';
import { getApiErrorMessage } from '../../../lib/api/errors';
import { dateTimeLocalInputToIso, toDateTimeLocalInput } from '../../../lib/dates';
import { formatMinutes } from '../../../lib/format';
import type { Playthrough, UserGameDetails } from '../../library/types';
import { parseDuration } from '../../library/validation';
import { detailApi } from '../api';
import { useGameMutation } from '../mutations';

const t = messages.detail.time;

interface TimeDialogProps {
  userGame: UserGameDetails;
  playthrough: Playthrough;
  onClose: () => void;
  onSaved: () => void;
}

const serverError = (error: unknown) => getApiErrorMessage(error, messages.library.serverErrors);

/** Explicit edit of a MANUAL playthrough's time. */
export function ManualTimeDialog({ userGame, playthrough, onClose, onSaved }: TimeDialogProps) {
  const [duration, setDuration] = useState(durationFromMinutes(playthrough.manualTimeMinutes));
  const [error, setError] = useState<string>();
  const mutation = useGameMutation(userGame.id, (minutes: number) =>
    detailApi.setManualTime(userGame.id, playthrough.id, minutes),
  );

  const submit = () => {
    const minutes = parseDuration(duration.hours, duration.minutes);
    if (minutes === null) {
      setError(messages.validation.minutesInvalid);
      return;
    }
    mutation.mutate(minutes, { onSuccess: onSaved });
  };

  return (
    <FormDialog
      open
      title={`${t.manualTitle} — ${messages.detail.playthroughs.title(playthrough.number)}`}
      onClose={onClose}
      onSubmit={submit}
      pending={mutation.isPending}
      error={mutation.isError ? serverError(mutation.error) : null}
    >
      <DurationFields
        label={messages.detail.playthroughs.time}
        value={duration}
        onChange={(value) => {
          setDuration(value);
          setError(undefined);
        }}
        error={error}
      />
    </FormDialog>
  );
}

/**
 * Switches MANUAL <-> SESSIONS without losing time: offers to turn the manual
 * time into an initial session; going back to MANUAL uses the sessions total.
 */
export function TimeModeDialog({ userGame, playthrough, onClose, onSaved }: TimeDialogProps) {
  const toSessions = playthrough.timeMode === 'MANUAL';
  const hasManualTime = toSessions && playthrough.manualTimeMinutes > 0;
  const [keepAsSession, setKeepAsSession] = useState(true);
  const [playedAt, setPlayedAt] = useState(toDateTimeLocalInput());
  const mutation = useGameMutation(userGame.id, (initialSession?: { playedAt: string }) =>
    detailApi.changeTimeMode(
      userGame.id,
      playthrough.id,
      toSessions ? 'SESSIONS' : 'MANUAL',
      initialSession,
    ),
  );
  const sessionsTotal = userGame.sessions
    .filter((s) => s.playthroughId === playthrough.id)
    .reduce((sum, s) => sum + s.durationMinutes, 0);

  const submit = () => {
    const initialSession =
      hasManualTime && keepAsSession ? { playedAt: dateTimeLocalInputToIso(playedAt) } : undefined;
    mutation.mutate(initialSession, { onSuccess: onSaved });
  };

  return (
    <FormDialog
      open
      title={`${t.modeTitle} — ${messages.detail.playthroughs.title(playthrough.number)}`}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={toSessions ? t.switchToSessions : t.switchToManual}
      pending={mutation.isPending}
      error={mutation.isError ? serverError(mutation.error) : null}
    >
      {toSessions ? (
        <>
          <Typography>{t.toSessionsBody}</Typography>
          {hasManualTime ? (
            <>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={keepAsSession}
                    onChange={(e) => setKeepAsSession(e.target.checked)}
                  />
                }
                label={t.keepAsSession(formatMinutes(playthrough.manualTimeMinutes))}
              />
              {keepAsSession ? (
                <TextField
                  label={t.keepAsSessionDate}
                  type="datetime-local"
                  value={playedAt}
                  onChange={(e) => setPlayedAt(e.target.value)}
                  slotProps={{
                    inputLabel: { shrink: true },
                    htmlInput: { max: toDateTimeLocalInput() },
                  }}
                />
              ) : (
                <Alert severity="warning" variant="outlined">
                  {t.dropManualWarning}
                </Alert>
              )}
            </>
          ) : null}
        </>
      ) : (
        <Typography>{t.toManualBody(formatMinutes(sessionsTotal))}</Typography>
      )}
    </FormDialog>
  );
}
