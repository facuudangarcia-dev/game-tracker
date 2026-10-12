import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import ScheduleIcon from '@mui/icons-material/Schedule';
import Box from '@mui/material/Box';
import FormHelperText from '@mui/material/FormHelperText';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { type FormEvent, type KeyboardEvent, useState } from 'react';
import { durationFromMinutes } from '../../../components/duration';
import { messages } from '../../../i18n/messages';
import { getApiErrorMessage } from '../../../lib/api/errors';
import { formatMinutes } from '../../../lib/format';
import { DifficultyBadge } from '../../library/DifficultyBadge';
import { difficultyLevel } from '../../library/difficultyColor';
import type { Playthrough, UserGameDetails } from '../../library/types';
import { parseDuration } from '../../library/validation';
import { detailApi, type PlaythroughChanges } from '../api';
import { useGameMutation } from '../mutations';

const t = messages.detail.playthroughs;

function usePlaythroughUpdate(userGame: UserGameDetails, playthrough: Playthrough) {
  return useGameMutation(userGame.id, (changes: PlaythroughChanges) =>
    detailApi.updatePlaythrough(userGame.id, playthrough.id, changes),
  );
}

function SmallEditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Tooltip title={label}>
      <IconButton aria-label={label} size="small" onClick={onClick} sx={{ p: 0.25 }}>
        <EditIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Tooltip>
  );
}

/**
 * The playthrough's time, editable in place (decision #71): the user types the
 * total and the previous time becomes total − sessions − Steam's time, so the
 * total can't be lower than its sessions. On Steam games the user's change is
 * kept on top of Steam's time at every sync (decision #78).
 */
export function PlaythroughTimeBox({
  userGame,
  playthrough,
}: {
  userGame: UserGameDetails;
  playthrough: Playthrough;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(durationFromMinutes(playthrough.minutes));
  const [error, setError] = useState<string | null>(null);
  const mutation = usePlaythroughUpdate(userGame, playthrough);
  const sessionsMinutes =
    playthrough.minutes - playthrough.previousMinutes - playthrough.steamMinutes;

  const start = () => {
    setValue(durationFromMinutes(playthrough.minutes));
    setError(null);
    mutation.reset();
    setEditing(true);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const total = parseDuration(value.hours, value.minutes);
    if (total === null) {
      setError(messages.validation.minutesInvalid);
      return;
    }
    if (total < sessionsMinutes) {
      setError(t.timeBelowSessions(formatMinutes(sessionsMinutes)));
      return;
    }
    setError(null);
    mutation.mutate(
      { previousMinutes: total - sessionsMinutes - playthrough.steamMinutes },
      { onSuccess: () => setEditing(false) },
    );
  };

  const cancelOnEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      setEditing(false);
    }
  };

  const shownError =
    error ??
    (mutation.isError ? getApiErrorMessage(mutation.error, messages.library.serverErrors) : null);

  return (
    <Box
      sx={(theme) => ({
        flexShrink: 0,
        minWidth: 150,
        px: 1.75,
        py: 1.25,
        borderRadius: 2,
        bgcolor: alpha(theme.palette.info.main, 0.08),
        border: `1px solid ${alpha(theme.palette.info.main, 0.22)}`,
      })}
    >
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', color: 'info.light' }}>
        <ScheduleIcon aria-hidden sx={{ fontSize: 16 }} />
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', flex: 1 }}
        >
          {t.totalTime}
        </Typography>
        {editing ? null : (
          <SmallEditButton label={t.editTime(playthrough.number)} onClick={start} />
        )}
      </Stack>
      {editing ? (
        <Box
          component="form"
          aria-label={t.editTime(playthrough.number)}
          onSubmit={submit}
          onKeyDown={cancelOnEscape}
          noValidate
          sx={{ mt: 1 }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <TextField
              label={messages.detail.time.hours}
              type="number"
              size="small"
              autoFocus
              value={value.hours}
              onChange={(e) => setValue({ ...value, hours: e.target.value })}
              error={Boolean(shownError)}
              slotProps={{ htmlInput: { min: 0, step: 1, inputMode: 'numeric' } }}
              sx={{ width: 84 }}
            />
            <TextField
              label={messages.detail.time.minutes}
              type="number"
              size="small"
              value={value.minutes}
              onChange={(e) => setValue({ ...value, minutes: e.target.value })}
              error={Boolean(shownError)}
              slotProps={{ htmlInput: { min: 0, max: 59, step: 1, inputMode: 'numeric' } }}
              sx={{ width: 84 }}
            />
            <IconButton
              type="submit"
              aria-label={messages.common.save}
              size="small"
              color="info"
              loading={mutation.isPending}
            >
              <CheckIcon fontSize="small" />
            </IconButton>
            <IconButton
              aria-label={messages.common.cancel}
              size="small"
              onClick={() => setEditing(false)}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
          {shownError ? (
            <FormHelperText error sx={{ maxWidth: 260 }}>
              {shownError}
            </FormHelperText>
          ) : sessionsMinutes > 0 || playthrough.steamMinutes > 0 ? (
            <FormHelperText sx={{ maxWidth: 260 }}>
              {[
                playthrough.steamMinutes > 0
                  ? t.timeIncludesSteam(formatMinutes(playthrough.steamMinutes))
                  : null,
                sessionsMinutes > 0 ? t.timeIncludesSessions(formatMinutes(sessionsMinutes)) : null,
              ]
                .filter(Boolean)
                .join(' ')}
            </FormHelperText>
          ) : null}
        </Box>
      ) : (
        <Typography sx={{ mt: 0.25, fontSize: '1.4rem', fontWeight: 900, lineHeight: 1.2 }}>
          {formatMinutes(playthrough.minutes)}
        </Typography>
      )}
    </Box>
  );
}

/** A difficulty with its color in its game's list, or the "no difficulty" text. */
export function DifficultyValue({
  userGame,
  kind,
  difficulty,
  empty,
}: {
  userGame: UserGameDetails;
  kind: 'PLAYTHROUGH' | 'PLATINUM';
  difficulty: { id: string; name: string } | null;
  empty: string;
}) {
  const place = difficultyLevel(userGame.difficulties, kind, difficulty?.id);
  if (!difficulty || !place) {
    return <span>{difficulty?.name ?? empty}</span>;
  }
  return <DifficultyBadge name={difficulty.name} {...place} />;
}

/** The playthrough's difficulty, editable in place with the game's list (decision #71). */
export function PlaythroughDifficulty({
  userGame,
  playthrough,
}: {
  userGame: UserGameDetails;
  playthrough: Playthrough;
}) {
  const [editing, setEditing] = useState(false);
  const mutation = usePlaythroughUpdate(userGame, playthrough);
  const difficulties = userGame.difficulties.filter((d) => d.kind === 'PLAYTHROUGH');
  const current = playthrough.difficulty?.id ?? '';

  const change = (difficultyId: string) => {
    if (difficultyId === current) {
      setEditing(false);
      return;
    }
    mutation.mutate({ difficultyId: difficultyId || null }, { onSuccess: () => setEditing(false) });
  };

  if (!editing) {
    return (
      <Stack direction="row" spacing={0.5} component="span" sx={{ alignItems: 'center' }}>
        <DifficultyValue
          userGame={userGame}
          kind="PLAYTHROUGH"
          difficulty={playthrough.difficulty}
          empty={t.noDifficulty}
        />
        <SmallEditButton
          label={t.editDifficulty(playthrough.number)}
          onClick={() => {
            mutation.reset();
            setEditing(true);
          }}
        />
      </Stack>
    );
  }

  return (
    <TextField
      select
      size="small"
      autoFocus
      value={current}
      disabled={mutation.isPending}
      onChange={(e) => change(e.target.value)}
      onBlur={() => {
        if (!mutation.isPending) {
          setEditing(false);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          setEditing(false);
        }
      }}
      error={mutation.isError}
      helperText={
        mutation.isError
          ? getApiErrorMessage(mutation.error, messages.library.serverErrors)
          : undefined
      }
      // The fact's title already says "Dificultad": the label is only for screen readers.
      slotProps={{ select: { native: true }, htmlInput: { 'aria-label': t.difficulty } }}
      sx={{ mt: 0.25, minWidth: 160 }}
    >
      <option value="">{t.noDifficulty}</option>
      {difficulties.map((difficulty) => (
        <option key={difficulty.id} value={difficulty.id}>
          {difficulty.name}
        </option>
      ))}
    </TextField>
  );
}
