import ScheduleIcon from '@mui/icons-material/Schedule';
import TextField from '@mui/material/TextField';
import { useState } from 'react';
import { durationFromMinutes } from '../../../components/duration';
import { DurationFields } from '../../../components/DurationFields';
import { FormDialog } from '../../../components/FormDialog';
import { NoteField } from '../../../components/NoteField';
import { messages } from '../../../i18n/messages';
import { getApiErrorMessage } from '../../../lib/api/errors';
import { dateTimeLocalInputToIso, toDateTimeLocalInput } from '../../../lib/dates';
import type { GamingSession, UserGameDetails } from '../../library/types';
import { noteError, parseDuration } from '../../library/validation';
import { detailApi, type SessionInput } from '../api';
import { useGameMutation } from '../mutations';

const t = messages.detail.sessions;

interface SessionDialogProps {
  userGame: UserGameDetails;
  /** Missing: registers a new session. */
  session?: GamingSession;
  /** Preselected playthrough for a new session. */
  playthroughId?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function SessionDialog({
  userGame,
  session,
  playthroughId,
  onClose,
  onSaved,
}: SessionDialogProps) {
  // Sessions can only be added to playthroughs in SESSIONS mode.
  const sessionPlaythroughs = userGame.playthroughs.filter((p) => p.timeMode === 'SESSIONS');
  const [targetId, setTargetId] = useState(playthroughId ?? sessionPlaythroughs[0]?.id ?? '');
  const [playedAt, setPlayedAt] = useState(
    toDateTimeLocalInput(session ? new Date(session.playedAt) : new Date()),
  );
  const [duration, setDuration] = useState(durationFromMinutes(session?.durationMinutes ?? null));
  const [notes, setNotes] = useState(session?.notes ?? '');
  const [errors, setErrors] = useState<{ playedAt?: string; duration?: string }>({});

  const mutation = useGameMutation(userGame.id, (input: SessionInput) =>
    session
      ? detailApi.updateSession(userGame.id, session.id, input)
      : detailApi.createSession(userGame.id, targetId, input),
  );

  const submit = () => {
    const minutes = parseDuration(duration.hours, duration.minutes);
    const nextErrors: typeof errors = {};
    if (minutes === null) {
      nextErrors.duration = messages.validation.minutesInvalid;
    } else if (minutes < 1) {
      nextErrors.duration = messages.validation.durationMin;
    }
    if (!playedAt) {
      nextErrors.playedAt = messages.validation.required;
    } else if (new Date(playedAt) > new Date()) {
      nextErrors.playedAt = messages.validation.dateInFuture;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || minutes === null || noteError(notes)) {
      return;
    }
    mutation.mutate(
      {
        playedAt: dateTimeLocalInputToIso(playedAt),
        durationMinutes: minutes,
        notes: notes.trim() ? notes : null,
      },
      { onSuccess: onSaved },
    );
  };

  return (
    <FormDialog
      icon={<ScheduleIcon />}
      eyebrow={userGame.game.name}
      open
      title={session ? t.editTitle : t.createTitle}
      onClose={onClose}
      onSubmit={submit}
      pending={mutation.isPending}
      error={
        mutation.isError ? getApiErrorMessage(mutation.error, messages.library.serverErrors) : null
      }
    >
      {!session ? (
        <TextField
          select
          label={t.playthrough}
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          slotProps={{ select: { native: true } }}
        >
          {sessionPlaythroughs.map((p) => (
            <option key={p.id} value={p.id}>
              {t.ofPlaythrough(p.number)}
              {p.name ? ` — ${p.name}` : ''}
            </option>
          ))}
        </TextField>
      ) : null}
      <TextField
        label={t.playedAt}
        type="datetime-local"
        value={playedAt}
        onChange={(e) => setPlayedAt(e.target.value)}
        error={Boolean(errors.playedAt)}
        helperText={errors.playedAt}
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: toDateTimeLocalInput() } }}
      />
      <DurationFields
        label={t.duration}
        value={duration}
        onChange={setDuration}
        error={errors.duration}
      />
      <NoteField label={t.notes} value={notes} onChange={setNotes} />
    </FormDialog>
  );
}
