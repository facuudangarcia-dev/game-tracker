import TextField from '@mui/material/TextField';
import { useState } from 'react';
import { FormDialog } from '../../../components/FormDialog';
import { messages } from '../../../i18n/messages';
import { getApiErrorMessage } from '../../../lib/api/errors';
import type { Difficulty } from '../../library/types';
import { DIFFICULTY_NAME_MAX_LENGTH } from '../../library/validation';
import { detailApi } from '../api';
import { useDifficultyMutation } from '../mutations';

const t = messages.detail.difficulties;

export function RenameDifficultyDialog({
  userGameId,
  difficulty,
  onClose,
}: {
  userGameId: string;
  difficulty: Difficulty;
  onClose: () => void;
}) {
  const [name, setName] = useState(difficulty.name);
  const [error, setError] = useState<string>();
  const mutation = useDifficultyMutation(userGameId, (newName: string) =>
    detailApi.renameDifficulty(userGameId, difficulty.id, newName),
  );

  const submit = () => {
    if (!name.trim()) {
      setError(messages.validation.required);
      return;
    }
    mutation.mutate(name.trim(), { onSuccess: onClose });
  };

  return (
    <FormDialog
      open
      title={t.renameTitle}
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
        autoFocus
        onChange={(e) => {
          setName(e.target.value);
          setError(undefined);
        }}
        error={Boolean(error)}
        helperText={error}
        slotProps={{ htmlInput: { maxLength: DIFFICULTY_NAME_MAX_LENGTH } }}
      />
    </FormDialog>
  );
}
