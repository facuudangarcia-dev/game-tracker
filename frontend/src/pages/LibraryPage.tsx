import AddIcon from '@mui/icons-material/Add';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { type ReactNode, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { catalogGamePath } from '../features/catalog/queries';
import { type AddGameConfig, AddGameDialog } from '../features/library/AddGameDialog';
import { AddToLibraryDialog } from '../features/library/AddToLibraryDialog';
import { LibraryCard } from '../features/library/LibraryCard';
import {
  filtersFromParams,
  hasActiveFilters,
  paramsFromFilters,
} from '../features/library/libraryFilters';
import { LibraryToolbar } from '../features/library/LibraryToolbar';
import { useLibrary } from '../features/library/queries';
import type { LibraryFilters } from '../features/library/types';
import { messages } from '../i18n/messages';

const t = messages.library;
const GRID_ITEM = { xs: 6, sm: 4, md: 3, lg: 2.4 } as const;

function EmptyState({ title, body, action }: { title: string; body: string; action: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 3, md: 5 }, textAlign: 'center' }}>
      <Typography variant="h6" component="h2" gutterBottom>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {body}
      </Typography>
      {action}
    </Paper>
  );
}

/** "Mis juegos": the main screen. Search, filters and sort live in the URL. */
export function LibraryPage() {
  const [params, setParams] = useSearchParams();
  const filters = filtersFromParams(params);
  const library = useLibrary(filters);
  const [adding, setAdding] = useState(false);
  const [configuring, setConfiguring] = useState<AddGameConfig | null>(null);
  const navigate = useNavigate();

  const setFilters = (next: LibraryFilters) =>
    setParams(paramsFromFilters(next), { replace: true });
  const addButton = (
    <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAdding(true)}>
      {t.addGame}
    </Button>
  );

  let content: ReactNode;
  if (library.isPending) {
    content = (
      <Grid container spacing={2} aria-busy="true" aria-label={messages.app.loading}>
        {Array.from({ length: 10 }, (_, i) => (
          <Grid key={i} size={GRID_ITEM}>
            <Skeleton variant="rounded" sx={{ aspectRatio: '3 / 4', height: 'auto' }} />
            <Skeleton width="80%" />
            <Skeleton width="50%" />
          </Grid>
        ))}
      </Grid>
    );
  } else if (library.isError) {
    content = (
      <Alert
        severity="error"
        variant="outlined"
        action={
          <Button color="inherit" size="small" onClick={() => void library.refetch()}>
            {messages.errors.retry}
          </Button>
        }
      >
        {t.loadError}
      </Alert>
    );
  } else if (library.data.length === 0) {
    content = hasActiveFilters(filters) ? (
      <EmptyState
        title={t.noResultsTitle}
        body={t.noResultsBody}
        action={
          <Button onClick={() => setFilters({ sort: filters.sort, order: filters.order })}>
            {t.filters.clear}
          </Button>
        }
      />
    ) : (
      <EmptyState title={t.emptyTitle} body={t.emptyBody} action={addButton} />
    );
  } else {
    content = (
      <>
        <Typography variant="body2" color="text.secondary" aria-live="polite">
          {t.resultCount(library.data.length)}
        </Typography>
        <Grid container spacing={2}>
          {library.data.map((item) => (
            <Grid key={item.id} size={GRID_ITEM}>
              <LibraryCard item={item} />
            </Grid>
          ))}
        </Grid>
      </>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}
      >
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          {t.title}
        </Typography>
        {addButton}
      </Stack>

      <LibraryToolbar filters={filters} onChange={setFilters} />
      {library.isFetching && !library.isPending ? <LinearProgress aria-label={t.updating} /> : null}
      {content}

      <AddGameDialog
        open={adding}
        onClose={() => setAdding(false)}
        onOpenCatalogGame={(result) => {
          setAdding(false);
          void navigate(catalogGamePath(result.provider ?? '', result.externalId ?? ''));
        }}
        onConfigure={(config) => {
          setAdding(false);
          setConfiguring(config);
        }}
      />
      {configuring ? (
        <AddToLibraryDialog
          {...configuring}
          onClose={() => setConfiguring(null)}
          onAdded={(userGame) => {
            setConfiguring(null);
            void navigate(`/games/${userGame.id}`);
          }}
        />
      ) : null}
    </Stack>
  );
}
