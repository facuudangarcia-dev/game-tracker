import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router';
import { Section } from '../components/Section';
import { useCatalogGame } from '../features/catalog/queries';
import { Facts } from '../features/game-detail/sections/MyGameSection';
import { AddToLibraryDialog } from '../features/library/AddToLibraryDialog';
import { GameCover } from '../features/library/GameCover';
import type { CatalogGame } from '../features/library/types';
import { messages } from '../i18n/messages';
import { ApiError } from '../lib/api/client';
import { getErrorCode } from '../lib/api/errors';
import { formatDate, formatYear } from '../lib/format';

const t = messages.catalog;

function chips(items: string[]): ReactNode {
  if (items.length === 0) {
    return t.none;
  }
  return (
    <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
      {items.map((item) => (
        <Chip key={item} size="small" variant="outlined" label={item} />
      ))}
    </Stack>
  );
}

/** Public page of a catalog game: "this game exists". Adding it is a separate, explicit step. */
export function CatalogGamePage() {
  const { provider = '', externalId = '' } = useParams();
  const query = useCatalogGame(provider, externalId);

  if (query.isPending) {
    return (
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={3}
        aria-busy="true"
        aria-label={messages.app.loading}
      >
        <Skeleton variant="rounded" width={220} height={293} />
        <Stack spacing={1} sx={{ flex: 1 }}>
          <Skeleton variant="text" width="60%" height={48} />
          <Skeleton variant="text" width="30%" />
          <Skeleton variant="rounded" width={160} height={40} />
          <Skeleton variant="rounded" height={120} />
        </Stack>
      </Stack>
    );
  }

  if (query.isError) {
    const code = getErrorCode(query.error);
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
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
        {notFound ? t.notFound : code === 'CATALOG_UNAVAILABLE' ? t.unavailable : t.loadError}
      </Alert>
    );
  }

  return <CatalogGameView game={query.data} />;
}

function CatalogGameView({ game }: { game: CatalogGame }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);

  const takenPlatformIds = game.libraryEntries.map((entry) => entry.platform.id);
  const canAdd = game.platforms.some((p) => !takenPlatformIds.includes(p.id));
  const year = formatYear(game.releaseDate);

  return (
    <Stack spacing={3}>
      <Stack
        component="header"
        aria-labelledby="catalog-game-title"
        direction={{ xs: 'column', sm: 'row' }}
        spacing={3}
      >
        <GameCover src={game.coverUrl} name={game.name} width={{ xs: 180, md: 240 }} />
        <Stack spacing={1.5} sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            id="catalog-game-title"
            variant="h4"
            component="h1"
            sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}
          >
            {game.name}
            {year ? (
              <Typography component="span" variant="h5" color="text.secondary">
                {` (${year})`}
              </Typography>
            ) : null}
          </Typography>
          {game.developers.length > 0 ? (
            <Typography color="text.secondary">{game.developers.join(', ')}</Typography>
          ) : null}

          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ flexWrap: 'wrap', alignItems: 'center', pt: 1 }}
          >
            <Button
              variant="contained"
              size="large"
              startIcon={<AddIcon />}
              disabled={!canAdd}
              onClick={() => setAdding(true)}
            >
              {t.addGame}
            </Button>
            {game.platforms.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t.noPlatforms}
              </Typography>
            ) : !canAdd ? (
              <Typography variant="body2" color="text.secondary">
                {t.allPlatformsAdded}
              </Typography>
            ) : null}
          </Stack>

          {game.libraryEntries.length > 0 ? (
            <Alert severity="success" variant="outlined" icon={<CheckCircleIcon />}>
              <Stack spacing={1}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {t.inLibrary}
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  {game.libraryEntries.map((entry) => (
                    <Button
                      key={entry.userGameId}
                      size="small"
                      variant="outlined"
                      color="success"
                      component={RouterLink}
                      to={`/games/${entry.userGameId}`}
                    >
                      {t.viewMyGame(entry.platform.shortName)}
                    </Button>
                  ))}
                </Stack>
              </Stack>
            </Alert>
          ) : null}
        </Stack>
      </Stack>

      <Section id="resumen" title={t.summary}>
        {game.summary ? (
          <Stack spacing={1}>
            <Typography sx={{ whiteSpace: 'pre-wrap' }}>{game.summary}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t.summaryLanguageNote}
            </Typography>
          </Stack>
        ) : (
          <Typography color="text.secondary">{t.noSummary}</Typography>
        )}
      </Section>

      <Section id="informacion" title={t.information}>
        <Facts
          items={[
            [t.platforms, chips(game.platforms.map((p) => p.name))],
            [t.releaseDate, formatDate(game.releaseDate)],
            [t.genres, chips(game.genres.map((g) => g.name))],
            [t.developers, game.developers.join(', ') || t.none],
            [t.publishers, game.publishers.join(', ') || t.none],
          ]}
        />
      </Section>

      {adding ? (
        <AddToLibraryDialog
          gameName={game.name}
          source={
            game.gameId
              ? { gameId: game.gameId }
              : { catalog: { provider: game.provider, externalId: game.externalId } }
          }
          platforms={game.platforms}
          takenPlatformIds={takenPlatformIds}
          onClose={() => setAdding(false)}
          onAdded={(userGame) => {
            void queryClient.invalidateQueries({ queryKey: ['catalog', 'game'] });
            void navigate(`/games/${userGame.id}`);
          }}
        />
      ) : null}
    </Stack>
  );
}
