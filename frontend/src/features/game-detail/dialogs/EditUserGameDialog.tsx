import EditIcon from '@mui/icons-material/Edit';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import { useState } from 'react';
import { FormDialog } from '../../../components/FormDialog';
import { NoteField } from '../../../components/NoteField';
import { messages } from '../../../i18n/messages';
import { getApiErrorMessage } from '../../../lib/api/errors';
import type { UserGameDetails } from '../../library/types';
import { noteError, parseRating, RATING_MAX, RATING_MIN } from '../../library/validation';
import { detailApi } from '../api';
import { useGameMutation } from '../mutations';

const t = messages.detail.editGameDialog;

/** Personal data only: the game and the platform identify the record. */
export function EditUserGameDialog({
  userGame,
  onClose,
  onSaved,
}: {
  userGame: UserGameDetails;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rating, setRating] = useState(userGame.rating === null ? '' : String(userGame.rating));
  const [notes, setNotes] = useState(userGame.notes ?? '');
  const [ratingError, setRatingError] = useState<string>();
  const mutation = useGameMutation(
    userGame.id,
    (changes: { rating: number | null; notes: string }) =>
      detailApi.updateGame(userGame.id, changes),
  );

  const submit = () => {
    const parsed = parseRating(rating);
    if ('error' in parsed) {
      setRatingError(parsed.error);
      return;
    }
    if (noteError(notes)) {
      return;
    }
    mutation.mutate({ rating: parsed.value, notes }, { onSuccess: onSaved });
  };

  return (
    <FormDialog
      icon={<EditIcon />}
      eyebrow={userGame.game.name}
      open
      title={t.title}
      onClose={onClose}
      onSubmit={submit}
      pending={mutation.isPending}
      error={
        mutation.isError ? getApiErrorMessage(mutation.error, messages.library.serverErrors) : null
      }
    >
      <Alert severity="info" variant="outlined">
        {t.readOnlyHint}
      </Alert>
      <TextField
        label={t.rating}
        type="number"
        value={rating}
        onChange={(e) => {
          setRating(e.target.value);
          setRatingError(undefined);
        }}
        error={Boolean(ratingError)}
        helperText={ratingError ?? t.ratingHelp}
        slotProps={{
          htmlInput: { min: RATING_MIN, max: RATING_MAX, step: 1, inputMode: 'numeric' },
        }}
      />
      <NoteField label={t.notes} value={notes} onChange={setNotes} />
    </FormDialog>
  );
}
