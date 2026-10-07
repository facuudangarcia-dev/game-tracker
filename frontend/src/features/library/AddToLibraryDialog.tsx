import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { FormDialog } from '../../components/FormDialog';
import { messages } from '../../i18n/messages';
import { getApiErrorMessage } from '../../lib/api/errors';
import { todayLocal } from '../../lib/dates';
import { useAddUserGame } from './queries';
import type { GameSource, Platform, PlayStatus, UserGameDetails } from './types';
import {
  DEFAULT_DIFFICULTY_NAMES,
  parseRating,
  RATING_MAX,
  RATING_MIN,
  validatePlaythroughDates,
} from './validation';

const t = messages.addToLibrary;
const STATUSES: PlayStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];
const DEFAULT_DIFFICULTY = 'Normal';

interface AddToLibraryDialogProps {
  gameName: string;
  source: GameSource;
  /** Platforms that can be chosen (for catalog games: only the catalog's). */
  platforms: Platform[];
  /** Platforms already in the library for this game (shown disabled). */
  takenPlatformIds?: string[];
  isManual?: boolean;
  onClose: () => void;
  onAdded: (userGame: UserGameDetails) => void;
}

/**
 * "How do I want to register this game?": platform, initial status, dates,
 * difficulty and optional rating. Creates the UserGame and its playthrough #1
 * in a single request.
 */
export function AddToLibraryDialog({
  gameName,
  source,
  platforms,
  takenPlatformIds = [],
  isManual = false,
  onClose,
  onAdded,
}: AddToLibraryDialogProps) {
  const available = platforms.filter((p) => !takenPlatformIds.includes(p.id));
  const [platformId, setPlatformId] = useState(available.length === 1 ? available[0].id : '');
  const [status, setStatus] = useState<PlayStatus>('PENDING');
  const [startDate, setStartDate] = useState('');
  const [completionDate, setCompletionDate] = useState('');
  const [difficulty, setDifficulty] = useState(DEFAULT_DIFFICULTY);
  const [rating, setRating] = useState('');
  const [errors, setErrors] = useState<{
    platform?: string;
    rating?: string;
    completionDate?: string;
  }>({});
  const mutation = useAddUserGame();
  const completed = status === 'COMPLETED';

  const submit = () => {
    const parsedRating = parseRating(rating);
    const dateErrors = validatePlaythroughDates(status, startDate, completed ? completionDate : '');
    const nextErrors = {
      platform: platformId ? undefined : messages.validation.required,
      rating: 'error' in parsedRating ? parsedRating.error : undefined,
      completionDate: dateErrors.completionDate,
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean) || 'error' in parsedRating) {
      return;
    }
    mutation.mutate(
      {
        ...source,
        platformId,
        initialPlaythrough: {
          status,
          startDate: startDate || null,
          completionDate: completed ? completionDate : null,
          difficulty: difficulty || null,
        },
        rating: parsedRating.value,
      },
      { onSuccess: onAdded },
    );
  };

  return (
    <FormDialog
      open
      title={t.title}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={t.submit}
      pending={mutation.isPending}
      error={
        mutation.isError ? getApiErrorMessage(mutation.error, messages.library.serverErrors) : null
      }
    >
      <Typography variant="h6" component="p" sx={{ fontWeight: 700 }}>
        {gameName}
      </Typography>
      {isManual ? (
        <Alert severity="info" variant="outlined">
          {t.manualHelp}
        </Alert>
      ) : null}
      <TextField
        select
        label={t.platform}
        required
        value={platformId}
        onChange={(e) => setPlatformId(e.target.value)}
        error={Boolean(errors.platform)}
        helperText={errors.platform}
        slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
      >
        <option value="" disabled>
          {t.choosePlatform}
        </option>
        {platforms.map((platform) => {
          const taken = takenPlatformIds.includes(platform.id);
          return (
            <option key={platform.id} value={platform.id} disabled={taken}>
              {taken ? t.alreadyAdded(platform.name) : platform.name}
            </option>
          );
        })}
      </TextField>
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
      {status !== 'PENDING' ? (
        <TextField
          label={t.startDate}
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      ) : null}
      {completed ? (
        <TextField
          label={t.completionDate}
          type="date"
          required
          value={completionDate}
          onChange={(e) => setCompletionDate(e.target.value)}
          error={Boolean(errors.completionDate)}
          helperText={errors.completionDate}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: todayLocal() } }}
        />
      ) : null}
      <TextField
        select
        label={t.difficulty}
        value={difficulty}
        onChange={(e) => setDifficulty(e.target.value)}
        helperText={t.difficultyHelp}
        slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
      >
        <option value="">{t.noDifficulty}</option>
        {DEFAULT_DIFFICULTY_NAMES.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </TextField>
      <TextField
        label={t.rating}
        type="number"
        value={rating}
        onChange={(e) => setRating(e.target.value)}
        error={Boolean(errors.rating)}
        helperText={errors.rating}
        slotProps={{
          htmlInput: { min: RATING_MIN, max: RATING_MAX, step: 1, inputMode: 'numeric' },
        }}
      />
    </FormDialog>
  );
}
