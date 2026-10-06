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
import { getApiErrorMessage } from '../../lib/api/errors';
import { formatYear } from '../../lib/format';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { GameCover } from './GameCover';
import { SEARCH_MIN_LENGTH, useAddUserGame, useCatalogSearch, usePlatforms } from './queries';
import type { AddUserGameInput, CatalogSearchResult, Platform, UserGameDetails } from './types';
import { GAME_NAME_MAX_LENGTH } from './validation';

const t = messages.addGame;

type Mode = 'catalog' | 'manual';

interface AddGameDialogProps {
  open: boolean;
  onClose: () => void;
  onAdded: (userGame: UserGameDetails) => void;
}

/**
 * Adds a game to the library: either a catalog search result (imported by the
 * backend if needed) or a new private manual game, always on one platform.
 */
export function AddGameDialog({ open, onClose, onAdded }: AddGameDialogProps) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down('sm'));
  const addGame = useAddUserGame();
  const platforms = usePlatforms();

  const [mode, setMode] = useState<Mode>('catalog');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CatalogSearchResult | null>(null);
  const [manualName, setManualName] = useState('');
  const [platformId, setPlatformId] = useState('');
  const [nameError, setNameError] = useState<string>();

  const debouncedQuery = useDebouncedValue(query, 300);
  const search = useCatalogSearch(mode === 'catalog' ? debouncedQuery : '');

  // Catalog games: only the platforms the catalog reports. Manual games: any platform.
  const platformOptions: Platform[] =
    mode === 'manual' || selected?.isManual ? (platforms.data ?? []) : (selected?.platforms ?? []);

  const reset = () => {
    setMode('catalog');
    setQuery('');
    setSelected(null);
    setManualName('');
    setPlatformId('');
    setNameError(undefined);
    addGame.reset();
  };

  const close = () => {
    reset();
    onClose();
  };

  const selectResult = (result: CatalogSearchResult) => {
    setSelected(result);
    const options = result.isManual ? (platforms.data ?? []) : result.platforms;
    setPlatformId(options.length === 1 ? options[0].id : '');
    addGame.reset();
  };

  const buildInput = (): AddUserGameInput | null => {
    if (!platformId) {
      return null;
    }
    if (mode === 'manual') {
      const name = manualName.trim();
      if (!name) {
        setNameError(t.nameRequired);
        return null;
      }
      return { platformId, manualGame: { name } };
    }
    if (!selected) {
      return null;
    }
    if (selected.gameId) {
      return { platformId, gameId: selected.gameId };
    }
    return {
      platformId,
      catalog: { provider: selected.provider ?? '', externalId: selected.externalId ?? '' },
    };
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const input = buildInput();
    if (input) {
      addGame.mutate(input, {
        onSuccess: (userGame) => {
          reset();
          onAdded(userGame);
        },
      });
    }
  };

  const canSubmit =
    Boolean(platformId) && (mode === 'manual' ? manualName.trim() !== '' : selected !== null);

  return (
    <Dialog open={open} onClose={close} fullScreen={fullScreen} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit} noValidate>
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
              onChange={(_e, value: Mode | null) => {
                if (value) {
                  setMode(value);
                  setPlatformId('');
                  setSelected(null);
                  addGame.reset();
                }
              }}
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
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelected(null);
                    setPlatformId('');
                  }}
                  helperText={
                    query.trim().length < SEARCH_MIN_LENGTH
                      ? t.searchHint(SEARCH_MIN_LENGTH)
                      : undefined
                  }
                />
                <SearchResults
                  isFetching={search.isFetching}
                  isError={search.isError}
                  data={search.data}
                  enabled={debouncedQuery.trim().length >= SEARCH_MIN_LENGTH}
                  selected={selected}
                  onSelect={selectResult}
                />
              </>
            ) : (
              <>
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
              </>
            )}

            {mode === 'manual' || selected ? (
              selected && !selected.isManual && selected.platforms.length === 0 ? (
                <Alert severity="info" variant="outlined">
                  {t.noPlatforms}
                </Alert>
              ) : (
                <TextField
                  select
                  label={t.platformLabel}
                  required
                  fullWidth
                  value={platformId}
                  onChange={(e) => setPlatformId(e.target.value)}
                  slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
                >
                  <option value="" disabled>
                    {t.choosePlatform}
                  </option>
                  {platformOptions.map((platform) => (
                    <option key={platform.id} value={platform.id}>
                      {platform.name}
                    </option>
                  ))}
                </TextField>
              )
            ) : null}

            {addGame.isError ? (
              <Alert severity="error" variant="outlined">
                {getApiErrorMessage(addGame.error, messages.library.serverErrors)}
              </Alert>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={close}>{messages.common.cancel}</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!canSubmit}
            loading={addGame.isPending}
          >
            {t.submit}
          </Button>
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
  selected: CatalogSearchResult | null;
  onSelect: (result: CatalogSearchResult) => void;
}

function resultKey(result: CatalogSearchResult): string {
  return result.gameId ?? `${result.provider}:${result.externalId}`;
}

function SearchResults({
  enabled,
  isFetching,
  isError,
  data,
  selected,
  onSelect,
}: SearchResultsProps) {
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
                selected={selected !== null && resultKey(selected) === resultKey(result)}
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
