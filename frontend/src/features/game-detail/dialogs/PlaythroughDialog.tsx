import FlagIcon from '@mui/icons-material/Flag';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { durationFromMinutes } from '../../../components/duration';
import { DurationFields } from '../../../components/DurationFields';
import { FormDialog } from '../../../components/FormDialog';
import { NoteField } from '../../../components/NoteField';
import { messages } from '../../../i18n/messages';
import { getApiErrorMessage } from '../../../lib/api/errors';
import { todayLocal } from '../../../lib/dates';
import { formatMinutes } from '../../../lib/format';
import type { PlayStatus, Playthrough, UserGameDetails } from '../../library/types';
import {
  noteError,
  parseDuration,
  PLAYTHROUGH_NAME_MAX_LENGTH,
  validatePlaythroughDates,
} from '../../library/validation';
import { detailApi, type PlaythroughChanges } from '../api';
import { useGameMutation } from '../mutations';

const t = messages.detail.playthroughs;
const STATUSES: PlayStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'PLAYED'];

interface PlaythroughDialogProps {
  userGame: UserGameDetails;
  /** Missing: creates a new playthrough ("+ Nueva partida"). */
  playthrough?: Playthrough;
  onClose: () => void;
  onSaved: () => void;
}

export function PlaythroughDialog({
  userGame,
  playthrough,
  onClose,
  onSaved,
}: PlaythroughDialogProps) {
  const [name, setName] = useState(playthrough?.name ?? '');
  const [status, setStatus] = useState<PlayStatus>(playthrough?.status ?? 'PENDING');
  const [difficultyId, setDifficultyId] = useState(playthrough?.difficulty?.id ?? '');
  const [startDate, setStartDate] = useState(playthrough?.startDate ?? '');
  const [completionDate, setCompletionDate] = useState(playthrough?.completionDate ?? '');
  const [notes, setNotes] = useState(playthrough?.notes ?? '');
  // Empty when there is none, so the fields show their labels instead of zeros.
  const [previous, setPrevious] = useState(
    durationFromMinutes(playthrough?.previousMinutes ? playthrough.previousMinutes : null),
  );
  const [showErrors, setShowErrors] = useState(false);

  const mutation = useGameMutation(userGame.id, (changes: PlaythroughChanges) =>
    playthrough
      ? detailApi.updatePlaythrough(userGame.id, playthrough.id, changes)
      : detailApi.createPlaythrough(userGame.id, changes),
  );

  const completed = status === 'COMPLETED';
  const errors = validatePlaythroughDates(status, startDate, completed ? completionDate : '');
  const difficulties = userGame.difficulties.filter((d) => d.kind === 'PLAYTHROUGH');

  // On Steam games the time is adjusted from the playthrough card (decision #78):
  // the previous time there may be negative, which these fields can't show.
  const steamTime = (playthrough?.steamMinutes ?? 0) > 0;
  const previousMinutes = steamTime ? 0 : parseDuration(previous.hours, previous.minutes);

  const submit = () => {
    setShowErrors(true);
    if (Object.keys(errors).length > 0 || noteError(notes) || previousMinutes === null) {
      return;
    }
    mutation.mutate(
      {
        name: name.trim() || null,
        status,
        difficultyId: difficultyId || null,
        startDate: startDate || null,
        // Only completed playthroughs have a completion date, and it's optional (#34, #70).
        completionDate: completed && completionDate ? completionDate : null,
        notes: notes.trim() ? notes : null,
        ...(steamTime ? {} : { previousMinutes: previousMinutes ?? 0 }),
      },
      { onSuccess: onSaved },
    );
  };

  return (
    <FormDialog
      icon={<FlagIcon />}
      eyebrow={userGame.game.name}
      open
      title={playthrough ? t.title(playthrough.number) : t.createTitle}
      onClose={onClose}
      onSubmit={submit}
      pending={mutation.isPending}
      error={
        mutation.isError ? getApiErrorMessage(mutation.error, messages.library.serverErrors) : null
      }
    >
      <TextField
        label={t.name}
        value={name}
        onChange={(e) => setName(e.target.value)}
        slotProps={{ htmlInput: { maxLength: PLAYTHROUGH_NAME_MAX_LENGTH } }}
      />
      <TextField
        select
        label={t.status}
        value={status}
        onChange={(e) => setStatus(e.target.value as PlayStatus)}
        slotProps={{ select: { native: true } }}
      >
        {STATUSES.map((value) => (
          <option key={value} value={value}>
            {messages.status[value]}
          </option>
        ))}
      </TextField>
      <TextField
        select
        label={t.difficulty}
        value={difficultyId}
        onChange={(e) => setDifficultyId(e.target.value)}
        slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
      >
        <option value="">{t.noDifficulty}</option>
        {difficulties.map((difficulty) => (
          <option key={difficulty.id} value={difficulty.id}>
            {difficulty.name}
          </option>
        ))}
      </TextField>
      <TextField
        label={t.startDate}
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <TextField
        label={t.completionDate}
        type="date"
        value={completed ? completionDate : ''}
        onChange={(e) => setCompletionDate(e.target.value)}
        disabled={!completed}
        error={showErrors && Boolean(errors.completionDate)}
        helperText={
          (showErrors && errors.completionDate) || (!completed ? t.completionHint : undefined)
        }
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: todayLocal() } }}
      />
      {steamTime ? (
        <Typography variant="body2" color="text.secondary">
          {t.steamTimeNote(formatMinutes(playthrough!.steamMinutes))}
        </Typography>
      ) : (
        <DurationFields
          label={t.previousTime}
          value={previous}
          onChange={setPrevious}
          error={
            showErrors && previousMinutes === null ? messages.validation.minutesInvalid : undefined
          }
          helperText={t.previousTimeHelp}
        />
      )}
      <NoteField label={t.notes} value={notes} onChange={setNotes} />
    </FormDialog>
  );
}
