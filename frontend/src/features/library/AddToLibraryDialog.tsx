import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import { alpha, useTheme } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { type FormEvent, useState } from 'react';
import { type Choice, ChoiceChips } from '../../components/ChoiceChips';
import { messages } from '../../i18n/messages';
import { getApiErrorMessage } from '../../lib/api/errors';
import { todayLocal } from '../../lib/dates';
import { ambientBackground, brandGradient, statusColor } from '../../theme/brand';
import { GameCover } from './GameCover';
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
const NO_DIFFICULTY = '';

interface AddToLibraryDialogProps {
  gameName: string;
  source: GameSource;
  /** Platforms that can be chosen (for catalog games: only the catalog's). */
  platforms: Platform[];
  /** Platforms already in the library for this game (shown disabled). */
  takenPlatformIds?: string[];
  isManual?: boolean;
  /** Shown in the header when available. */
  coverUrl?: string | null;
  artworkUrl?: string | null;
  year?: string | null;
  onClose: () => void;
  onAdded: (userGame: UserGameDetails) => void;
}

/** Live preview of the rating as a ring, like on the Home. */
function RatingRing({ rating }: { rating: number | null }) {
  return (
    <Box sx={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }} aria-hidden>
      <CircularProgress
        variant="determinate"
        value={100}
        size={56}
        thickness={4}
        sx={(theme) => ({ color: alpha(theme.palette.common.white, 0.08), position: 'absolute' })}
      />
      <CircularProgress variant="determinate" value={rating ?? 0} size={56} thickness={4} />
      <Typography
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          fontWeight: 900,
          color: rating === null ? 'text.disabled' : 'text.primary',
        }}
      >
        {rating ?? '–'}
      </Typography>
    </Box>
  );
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
  coverUrl = null,
  artworkUrl = null,
  year = null,
  onClose,
  onAdded,
}: AddToLibraryDialogProps) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down('sm'));
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
  const parsedRating = parseRating(rating);
  const ratingPreview = 'error' in parsedRating ? null : parsedRating.value;

  const statusChoices: Choice<PlayStatus>[] = STATUSES.map((value) => ({
    value,
    label: messages.status[value],
    marker: (
      <Box
        aria-hidden
        sx={(theme) => ({
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: statusColor(theme, value),
          boxShadow: `0 0 6px ${statusColor(theme, value)}`,
        })}
      />
    ),
  }));
  const difficultyChoices: Choice<string>[] = [
    { value: NO_DIFFICULTY, label: t.noDifficulty },
    ...DEFAULT_DIFFICULTY_NAMES.map((name) => ({ value: name, label: name })),
  ];

  const submit = (event: FormEvent) => {
    event.preventDefault();
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

  const error = mutation.isError
    ? getApiErrorMessage(mutation.error, messages.library.serverErrors)
    : null;

  return (
    <Dialog
      open
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="sm"
      aria-labelledby="add-to-library-title"
      slotProps={{
        paper: {
          sx: (theme) => ({
            borderRadius: fullScreen ? 0 : 4,
            overflow: 'hidden',
            backgroundImage: 'none',
            bgcolor: 'background.default',
            border: fullScreen ? 'none' : `1px solid ${alpha(theme.palette.common.white, 0.1)}`,
            boxShadow: `0 40px 90px -30px ${alpha(theme.palette.primary.main, 0.55)}`,
          }),
        },
      }}
    >
      <Box
        component="form"
        onSubmit={submit}
        noValidate
        sx={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: fullScreen ? '100%' : undefined,
        }}
      >
        {/* Header: the game, over its artwork (or the ambient backdrop). */}
        <Box
          sx={(theme) => ({
            position: 'relative',
            isolation: 'isolate',
            display: 'flex',
            alignItems: 'flex-end',
            gap: 2,
            px: 3,
            pt: 5,
            pb: 2.5,
            background: ambientBackground(theme),
          })}
        >
          {artworkUrl ? (
            <Box
              component="img"
              src={artworkUrl}
              alt=""
              aria-hidden
              sx={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                zIndex: -2,
              }}
            />
          ) : null}
          <Box
            aria-hidden
            sx={(theme) => ({
              position: 'absolute',
              inset: 0,
              zIndex: -1,
              background: `linear-gradient(0deg, ${theme.palette.background.default} 2%, ${alpha(theme.palette.background.default, 0.7)} 55%, ${alpha(theme.palette.background.default, 0.35)} 100%)`,
            })}
          />
          <Box
            sx={(theme) => ({
              borderRadius: 1.5,
              overflow: 'hidden',
              flexShrink: 0,
              boxShadow: `0 14px 30px -10px rgba(0,0,0,0.8), 0 0 0 1px ${alpha(theme.palette.common.white, 0.12)}`,
            })}
          >
            <GameCover src={coverUrl} name={gameName} width={{ xs: 72, sm: 88 }} square />
          </Box>
          <Box sx={{ minWidth: 0, pb: 0.5 }}>
            <Typography
              id="add-to-library-title"
              variant="overline"
              color="primary"
              sx={{ fontWeight: 800, letterSpacing: 1.8, lineHeight: 1.6 }}
            >
              {t.title}
            </Typography>
            <Typography
              variant="h5"
              component="p"
              sx={{
                fontWeight: 900,
                lineHeight: 1.15,
                letterSpacing: -0.5,
                overflowWrap: 'anywhere',
              }}
            >
              {gameName}
              {year ? (
                <Typography
                  component="span"
                  variant="h6"
                  color="text.secondary"
                  sx={{ fontWeight: 400 }}
                >
                  {` (${year})`}
                </Typography>
              ) : null}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t.subtitle}
            </Typography>
          </Box>
          <IconButton
            aria-label={messages.common.close}
            onClick={onClose}
            sx={(theme) => ({
              position: 'absolute',
              top: 10,
              right: 10,
              bgcolor: alpha(theme.palette.background.default, 0.5),
              backdropFilter: 'blur(8px)',
            })}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Stack spacing={2.75} sx={{ px: 3, pt: 2.5, pb: 3, flex: 1 }}>
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

          <ChoiceChips
            id="add-status"
            label={t.status}
            value={status}
            choices={statusChoices}
            onChange={setStatus}
            fill
          />

          {status !== 'PENDING' ? (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                fullWidth
                label={t.startDate}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: todayLocal() } }}
              />
              {completed ? (
                <TextField
                  fullWidth
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
            </Stack>
          ) : null}

          <Box>
            <ChoiceChips
              id="add-difficulty"
              label={t.difficulty}
              value={difficulty}
              choices={difficultyChoices}
              onChange={setDifficulty}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 0.75 }}
            >
              {t.difficultyHelp}
            </Typography>
          </Box>

          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <RatingRing rating={ratingPreview} />
            <TextField
              fullWidth
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
          </Stack>

          {error ? (
            <Alert severity="error" variant="outlined">
              {error}
            </Alert>
          ) : null}
        </Stack>

        <Stack
          direction={{ xs: 'column-reverse', sm: 'row' }}
          spacing={1.5}
          sx={(theme) => ({
            px: 3,
            py: 2,
            justifyContent: 'flex-end',
            borderTop: `1px solid ${theme.palette.divider}`,
            bgcolor: 'background.paper',
          })}
        >
          <Button onClick={onClose} color="inherit">
            {messages.common.cancel}
          </Button>
          <Button
            type="submit"
            variant="contained"
            size="large"
            startIcon={<AddIcon />}
            loading={mutation.isPending}
            sx={(theme) => ({
              px: 3.5,
              fontWeight: 800,
              color: theme.palette.common.white,
              background: brandGradient(theme, 110),
              boxShadow: `0 12px 28px -12px ${alpha(theme.palette.primary.main, 0.9)}`,
              '&:hover': { background: brandGradient(theme, 110), filter: 'brightness(1.08)' },
            })}
          >
            {t.submit}
          </Button>
        </Stack>
      </Box>
    </Dialog>
  );
}
