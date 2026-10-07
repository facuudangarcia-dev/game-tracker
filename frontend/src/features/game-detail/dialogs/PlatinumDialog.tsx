import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import { useState } from 'react';
import { durationFromMinutes } from '../../../components/duration';
import { DurationFields } from '../../../components/DurationFields';
import { FormDialog } from '../../../components/FormDialog';
import { messages } from '../../../i18n/messages';
import { getApiErrorMessage } from '../../../lib/api/errors';
import { todayLocal } from '../../../lib/dates';
import type { UserGameDetails } from '../../library/types';
import { parseDuration } from '../../library/validation';
import { detailApi, type PlatinumInput } from '../api';
import { useGameMutation } from '../mutations';

const t = messages.detail.platinum;

/**
 * Platinum is independent of status, playtime and playthrough difficulty.
 * Its fields are disabled until "achieved" is on.
 */
export function PlatinumDialog({
  userGame,
  onClose,
  onSaved,
}: {
  userGame: UserGameDetails;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { platinum } = userGame;
  const [achieved, setAchieved] = useState(platinum.achieved);
  const [date, setDate] = useState(platinum.date ?? '');
  const [duration, setDuration] = useState(durationFromMinutes(platinum.timeMinutes));
  const [difficultyId, setDifficultyId] = useState(platinum.difficulty?.id ?? '');
  const [errors, setErrors] = useState<{ date?: string; time?: string }>({});

  const mutation = useGameMutation(userGame.id, (input: PlatinumInput) =>
    detailApi.updatePlatinum(userGame.id, input),
  );
  const difficulties = userGame.difficulties.filter((d) => d.kind === 'PLATINUM');

  const submit = () => {
    if (!achieved) {
      mutation.mutate({ achieved: false }, { onSuccess: onSaved });
      return;
    }
    const minutes = parseDuration(duration.hours, duration.minutes);
    const nextErrors: typeof errors = {};
    if (!date) {
      nextErrors.date = messages.validation.required;
    } else if (date > todayLocal()) {
      nextErrors.date = messages.validation.dateInFuture;
    } else if (userGame.startDate && date < userGame.startDate) {
      nextErrors.date = messages.validation.platinumBeforeStart;
    }
    if (minutes === null) {
      nextErrors.time = messages.validation.minutesInvalid;
    } else if (minutes < 1) {
      nextErrors.time = messages.validation.durationMin;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    mutation.mutate(
      { achieved: true, date, timeMinutes: minutes, difficultyId: difficultyId || null },
      { onSuccess: onSaved },
    );
  };

  return (
    <FormDialog
      icon={<EmojiEventsIcon />}
      eyebrow={userGame.game.name}
      open
      title={t.edit}
      onClose={onClose}
      onSubmit={submit}
      pending={mutation.isPending}
      error={
        mutation.isError ? getApiErrorMessage(mutation.error, messages.library.serverErrors) : null
      }
    >
      <FormControlLabel
        control={<Switch checked={achieved} onChange={(e) => setAchieved(e.target.checked)} />}
        label={t.achieved}
      />
      <TextField
        label={t.date}
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        disabled={!achieved}
        required={achieved}
        error={Boolean(errors.date)}
        helperText={errors.date}
        slotProps={{
          inputLabel: { shrink: true },
          htmlInput: { max: todayLocal(), min: userGame.startDate ?? undefined },
        }}
      />
      <DurationFields
        label={t.time}
        value={duration}
        onChange={setDuration}
        disabled={!achieved}
        error={errors.time}
        helperText={t.timeHelp}
      />
      <TextField
        select
        label={t.difficulty}
        value={difficultyId}
        onChange={(e) => setDifficultyId(e.target.value)}
        disabled={!achieved}
        slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
      >
        <option value="">{t.noDifficulty}</option>
        {difficulties.map((difficulty) => (
          <option key={difficulty.id} value={difficulty.id}>
            {difficulty.name}
          </option>
        ))}
      </TextField>
    </FormDialog>
  );
}
