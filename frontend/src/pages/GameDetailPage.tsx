import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { detailApi } from '../features/game-detail/api';
import type { DetailAction } from '../features/game-detail/detailActions';
import { EditUserGameDialog } from '../features/game-detail/dialogs/EditUserGameDialog';
import { PlatinumDialog } from '../features/game-detail/dialogs/PlatinumDialog';
import { PlaythroughDialog } from '../features/game-detail/dialogs/PlaythroughDialog';
import { RenameDifficultyDialog } from '../features/game-detail/dialogs/RenameDifficultyDialog';
import { SessionDialog } from '../features/game-detail/dialogs/SessionDialog';
import { ManualTimeDialog, TimeModeDialog } from '../features/game-detail/dialogs/TimeDialogs';
import { useDifficultyMutation, useGameMutation } from '../features/game-detail/mutations';
import { DetailHeader } from '../features/game-detail/sections/DetailHeader';
import { DifficultiesSection } from '../features/game-detail/sections/DifficultiesSection';
import { MyGameSection } from '../features/game-detail/sections/MyGameSection';
import { NotesSection } from '../features/game-detail/sections/NotesSection';
import { PlatinumSection } from '../features/game-detail/sections/PlatinumSection';
import { PlaythroughsSection } from '../features/game-detail/sections/PlaythroughsSection';
import { SessionsSection } from '../features/game-detail/sections/SessionsSection';
import { libraryKeys, useUserGame } from '../features/library/queries';
import type { UserGameDetails } from '../features/library/types';
import { messages } from '../i18n/messages';
import { ApiError } from '../lib/api/client';
import { getApiErrorMessage } from '../lib/api/errors';
import { formatDateTime } from '../lib/dates';

const t = messages.detail;
const serverError = (error: unknown) =>
  error ? getApiErrorMessage(error, messages.library.serverErrors) : null;

/** Detail of one game of the library: a single page divided into sections (no tabs). */
export function GameDetailPage() {
  const { userGameId = '' } = useParams();
  const query = useUserGame(userGameId);
  const [action, setAction] = useState<DetailAction | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const close = () => setAction(null);
  const saved = () => {
    setAction(null);
    setNotice(t.saved);
  };

  const backLink = (
    <Button
      component={RouterLink}
      to="/games"
      startIcon={<ArrowBackIcon />}
      sx={{ alignSelf: 'flex-start' }}
    >
      {t.backToLibrary}
    </Button>
  );

  if (query.isPending) {
    return (
      <Stack spacing={3} aria-busy="true" aria-label={messages.app.loading}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
          <Skeleton variant="rounded" width={200} height={267} />
          <Stack spacing={1} sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" height={48} />
            <Skeleton variant="text" width="40%" />
            <Skeleton variant="rounded" height={32} width="70%" />
          </Stack>
        </Stack>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={160} />
        ))}
      </Stack>
    );
  }

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <Stack spacing={2}>
        {backLink}
        <Alert
          severity={notFound ? 'info' : 'error'}
          variant="outlined"
          action={
            notFound ? undefined : (
              <Button color="inherit" size="small" onClick={() => void query.refetch()}>
                {messages.errors.retry}
              </Button>
            )
          }
        >
          {notFound ? t.notFound : t.loadError}
        </Alert>
      </Stack>
    );
  }

  const userGame = query.data;
  return (
    <Stack spacing={{ xs: 3, md: 4 }}>
      {backLink}
      <DetailHeader userGame={userGame} onAction={setAction} />
      <MyGameSection userGame={userGame} />
      {/* Your run (playthroughs, sessions, notes) as the main column; platinum and
          difficulties on the side. */}
      <Box
        sx={{
          display: 'grid',
          gap: { xs: 3, md: 4 },
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 360px' },
          alignItems: 'start',
        }}
      >
        <Stack spacing={{ xs: 3, md: 4 }} sx={{ minWidth: 0 }}>
          <PlaythroughsSection userGame={userGame} onAction={setAction} />
          <SessionsSection userGame={userGame} onAction={setAction} />
          <NotesSection userGame={userGame} onAction={setAction} />
        </Stack>
        <Stack spacing={{ xs: 3, md: 4 }} sx={{ minWidth: 0 }}>
          <PlatinumSection userGame={userGame} onAction={setAction} />
          <DifficultiesSection userGame={userGame} onAction={setAction} />
        </Stack>
      </Box>

      <DetailDialogs userGame={userGame} action={action} onClose={close} onSaved={saved} />
      <Snackbar
        open={notice !== null}
        autoHideDuration={3000}
        onClose={() => setNotice(null)}
        message={notice}
      />
    </Stack>
  );
}

interface DetailDialogsProps {
  userGame: UserGameDetails;
  action: DetailAction | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Renders the dialog for the current action (mounted only while open). */
function DetailDialogs({ userGame, action, onClose, onSaved }: DetailDialogsProps) {
  if (!action) {
    return null;
  }
  const common = { userGame, onClose, onSaved };

  switch (action.type) {
    case 'editGame':
      return <EditUserGameDialog {...common} />;
    case 'deleteGame':
      return <DeleteGameDialog userGame={userGame} onClose={onClose} />;
    case 'newPlaythrough':
      return <PlaythroughDialog {...common} />;
    case 'editPlaythrough':
      return <PlaythroughDialog {...common} playthrough={action.playthrough} />;
    case 'deletePlaythrough':
      return (
        <DeleteConfirm
          {...common}
          title={t.playthroughs.delete(action.playthrough.number)}
          body={t.playthroughs.deleteBody}
          mutate={() => detailApi.deletePlaythrough(userGame.id, action.playthrough.id)}
        />
      );
    case 'manualTime':
      return <ManualTimeDialog {...common} playthrough={action.playthrough} />;
    case 'timeMode':
      return <TimeModeDialog {...common} playthrough={action.playthrough} />;
    case 'newSession':
      return <SessionDialog {...common} playthroughId={action.playthroughId} />;
    case 'editSession':
      return <SessionDialog {...common} session={action.session} />;
    case 'deleteSession':
      return (
        <DeleteConfirm
          {...common}
          title={t.sessions.delete(formatDateTime(action.session.playedAt))}
          body={t.sessions.deleteBody}
          mutate={() => detailApi.deleteSession(userGame.id, action.session.id)}
        />
      );
    case 'platinum':
      return <PlatinumDialog {...common} />;
    case 'renameDifficulty':
      return (
        <RenameDifficultyDialog
          userGameId={userGame.id}
          difficulty={action.difficulty}
          onClose={onClose}
        />
      );
    case 'deleteDifficulty':
      return (
        <DeleteDifficultyDialog
          userGameId={userGame.id}
          gameName={userGame.game.name}
          difficultyId={action.difficulty.id}
          name={action.difficulty.name}
          onClose={onClose}
        />
      );
  }
}

function DeleteConfirm({
  userGame,
  title,
  body,
  mutate,
  onClose,
  onSaved,
}: {
  userGame: UserGameDetails;
  title: string;
  body: string;
  mutate: () => Promise<UserGameDetails>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const mutation = useGameMutation(userGame.id, mutate);
  const gameName = userGame.game.name;
  return (
    <ConfirmDialog
      open
      eyebrow={gameName}
      title={title}
      body={body}
      pending={mutation.isPending}
      error={serverError(mutation.error)}
      onConfirm={() => mutation.mutate(undefined, { onSuccess: onSaved })}
      onClose={onClose}
    />
  );
}

function DeleteDifficultyDialog({
  userGameId,
  gameName,
  difficultyId,
  name,
  onClose,
}: {
  userGameId: string;
  gameName: string;
  difficultyId: string;
  name: string;
  onClose: () => void;
}) {
  const mutation = useDifficultyMutation(userGameId, () =>
    detailApi.deleteDifficulty(userGameId, difficultyId),
  );
  return (
    <ConfirmDialog
      open
      eyebrow={gameName}
      title={t.difficulties.delete(name)}
      body={t.difficulties.deleteBody(name)}
      pending={mutation.isPending}
      error={serverError(mutation.error)}
      onConfirm={() => mutation.mutate(undefined, { onSuccess: onClose })}
      onClose={onClose}
    />
  );
}

/** Deleting a UserGame removes all personal data; the catalog game stays. */
function DeleteGameDialog({
  userGame,
  onClose,
}: {
  userGame: UserGameDetails;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const gameName = userGame.game.name;
  const mutation = useMutation({
    mutationFn: () => detailApi.deleteGame(userGame.id),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: libraryKeys.detail(userGame.id) });
      await queryClient.invalidateQueries({ queryKey: libraryKeys.list() });
      await navigate('/games', { replace: true });
    },
  });
  return (
    <ConfirmDialog
      open
      eyebrow={gameName}
      title={t.deleteGame}
      body={t.deleteGameBody(userGame.game.name, userGame.platform.name)}
      pending={mutation.isPending}
      error={serverError(mutation.error)}
      onConfirm={() => mutation.mutate()}
      onClose={onClose}
    />
  );
}
