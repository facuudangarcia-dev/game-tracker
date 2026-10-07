import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { type FormEvent, useState } from 'react';
import { messages } from '../../i18n/messages';
import { formatYear } from '../../lib/format';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { GameCover } from './GameCover';
import { SEARCH_MIN_LENGTH, useCatalogSearch, usePlatforms } from './queries';
import type { CatalogSearchResult, GameSource, Platform } from './types';
import { GAME_NAME_MAX_LENGTH } from './validation';

const t = messages.addGame;

type Mode = 'catalog' | 'manual';

/** What to register, handed to the settings dialog (AddToLibraryDialog). */
export interface AddGameConfig {
  gameName: string;
  source: GameSource;
  platforms: Platform[];
  isManual: boolean;
}

interface AddGameDialogProps {
  open: boolean;
  onClose: () => void;
  /** Catalog games are added from their catalog page (single path). */
  onOpenCatalogGame: (result: CatalogSearchResult) => void;
  /** Manual games (new or own existing ones) go straight to the settings dialog. */
  onConfigure: (config: AddGameConfig) => void;
}

/**
 * Entry point of "Agregar juego" in Mis juegos: pick a catalog game (opens its
 * catalog page) or a manual game (private, any platform).
 */
export function AddGameDialog({
  open,
  onClose,
  onOpenCatalogGame,
  onConfigure,
}: AddGameDialogProps) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down('sm'));
  const platforms = usePlatforms();
  const [mode, setMode] = useState<Mode>('catalog');
  const [query, setQuery] = useState('');
  const [manualName, setManualName] = useState('');
  const [nameError, setNameError] = useState<string>();

  const debouncedQuery = useDebouncedValue(query, 300);
  const search = useCatalogSearch(mode === 'catalog' ? debouncedQuery : '');
  const allPlatforms = platforms.data ?? [];

  const close = () => {
    setMode('catalog');
    setQuery('');
    setManualName('');
    setNameError(undefined);
    onClose();
  };

  const selectResult = (result: CatalogSearchResult) => {
    if (result.isManual && result.gameId) {
      onConfigure({
        gameName: result.name,
        source: { gameId: result.gameId },
        platforms: allPlatforms,
        isManual: true,
      });
    } else {
      onOpenCatalogGame(result);
    }
  };

  const continueManual = (event: FormEvent) => {
    event.preventDefault();
    const name = manualName.trim();
    if (!name) {
      setNameError(t.nameRequired);
      return;
    }
    onConfigure({
      gameName: name,
      source: { manualGame: { name } },
      platforms: allPlatforms,
      isManual: true,
    });
  };

  return (
    <Dialog open={open} onClose={close} fullScreen={fullScreen} fullWidth maxWidth="sm">
      <form onSubmit={continueManual} noValidate>
        <DialogTitle>{t.title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              color="primary"
              aria-label={t.modeLabel}
              value={mode}
              onChange={(_e, value: Mode | null) => value && setMode(value)}
            >
              <ToggleButton value="catalog">{t.catalogMode}</ToggleButton>
              <ToggleButton value="manual">{t.manualMode}</ToggleButton>
            </ToggleButtonGroup>

            {mode === 'catalog' ? (
              <>
                <TextField
                  label={t.searchLabel}
                  type="search"
                  autoFocus
                  fullWidth
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  helperText={
                    query.trim().length < SEARCH_MIN_LENGTH
                      ? t.searchHint(SEARCH_MIN_LENGTH)
                      : t.openCatalogHint
                  }
                />
                <SearchResults
                  isFetching={search.isFetching}
                  isError={search.isError}
                  data={search.data}
                  enabled={debouncedQuery.trim().length >= SEARCH_MIN_LENGTH}
                  onSelect={selectResult}
                />
              </>
            ) : (
              <TextField
                label={t.nameLabel}
                required
                autoFocus
                fullWidth
                value={manualName}
                onChange={(e) => {
                  setManualName(e.target.value);
                  setNameError(undefined);
                }}
                error={Boolean(nameError)}
                helperText={nameError ?? t.manualHelp}
                slotProps={{ htmlInput: { maxLength: GAME_NAME_MAX_LENGTH } }}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={close}>{messages.common.cancel}</Button>
          {mode === 'manual' ? (
            <Button type="submit" variant="contained" disabled={manualName.trim() === ''}>
              {t.continue}
            </Button>
          ) : null}
        </DialogActions>
      </form>
    </Dialog>
  );
}

interface SearchResultsProps {
  enabled: boolean;
  isFetching: boolean;
  isError: boolean;
  data: { results: CatalogSearchResult[]; catalogAvailable: boolean } | undefined;
  onSelect: (result: CatalogSearchResult) => void;
}

function resultKey(result: CatalogSearchResult): string {
  return result.gameId ?? `${result.provider}:${result.externalId}`;
}

function SearchResults({ enabled, isFetching, isError, data, onSelect }: SearchResultsProps) {
  if (!enabled) {
    return null;
  }
  if (isFetching && !data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={28} aria-label={t.searching} />
      </Box>
    );
  }
  if (isError) {
    return (
      <Alert severity="error" variant="outlined">
        {t.searchError}
      </Alert>
    );
  }
  if (!data) {
    return null;
  }

  return (
    <Stack spacing={1}>
      {!data.catalogAvailable ? (
        <Alert severity="warning" variant="outlined">
          {t.catalogUnavailable}
        </Alert>
      ) : null}
      {data.results.length === 0 ? (
        <Typography color="text.secondary">{t.noResults}</Typography>
      ) : (
        <List
          aria-label={t.results}
          dense
          sx={{ maxHeight: { xs: 'none', sm: 320 }, overflowY: 'auto', mx: -1 }}
        >
          {data.results.map((result) => {
            const year = formatYear(result.releaseDate);
            const platformNames = result.platforms.map((p) => p.shortName).join(' · ');
            return (
              <ListItemButton
                key={resultKey(result)}
                onClick={() => onSelect(result)}
                sx={{ gap: 1.5, borderRadius: 1 }}
              >
                <GameCover src={result.coverUrl} name={result.name} width={40} />
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <span>{result.name}</span>
                      {result.isManual ? (
                        <Chip size="small" variant="outlined" label={t.manualBadge} />
                      ) : null}
                    </Stack>
                  }
                  secondary={[year, platformNames].filter(Boolean).join(' — ') || undefined}
                />
              </ListItemButton>
            );
          })}
        </List>
      )}
    </Stack>
  );
}
