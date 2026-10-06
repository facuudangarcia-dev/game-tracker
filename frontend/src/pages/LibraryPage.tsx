import AddIcon from '@mui/icons-material/Add';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AddGameDialog } from '../features/library/AddGameDialog';
import { LibraryCard } from '../features/library/LibraryCard';
import { useLibrary } from '../features/library/queries';
import { messages } from '../i18n/messages';

const t = messages.library;
const GRID_ITEM = { xs: 6, sm: 4, md: 3, lg: 2.4 } as const;

export function LibraryPage() {
  const library = useLibrary();
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const navigate = useNavigate();

  return (
    <Stack spacing={3}>
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          {t.title}
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAdding(true)}>
          {t.addGame}
        </Button>
      </Stack>

      {library.isPending ? (
        <Grid container spacing={2} aria-busy="true" aria-label={messages.app.loading}>
          {Array.from({ length: 10 }, (_, i) => (
            <Grid key={i} size={GRID_ITEM}>
              <Skeleton variant="rounded" sx={{ aspectRatio: '3 / 4', height: 'auto' }} />
              <Skeleton width="80%" />
              <Skeleton width="50%" />
            </Grid>
          ))}
        </Grid>
      ) : library.isError ? (
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
      ) : library.data.length === 0 ? (
        <Paper variant="outlined" sx={{ p: { xs: 3, md: 5 }, textAlign: 'center' }}>
          <Typography variant="h6" component="h2" gutterBottom>
            {t.emptyTitle}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {t.emptyBody}
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAdding(true)}>
            {t.addGame}
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {library.data.map((item) => (
            <Grid key={item.id} size={GRID_ITEM}>
              <LibraryCard item={item} />
            </Grid>
          ))}
        </Grid>
      )}

      <AddGameDialog
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={(userGame) => {
          setAdding(false);
          setNotice(t.added);
          void navigate(`/games/${userGame.id}`);
        }}
      />
      <Snackbar
        open={notice !== null}
        autoHideDuration={4000}
        onClose={() => setNotice(null)}
        message={notice}
      />
    </Stack>
  );
}
