import EditNoteIcon from '@mui/icons-material/EditNote';
import SearchIcon from '@mui/icons-material/Search';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import { alpha, useTheme } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { type FormEvent, useState } from 'react';
import { DialogFooter, DialogHeader } from '../../components/DialogChrome';
import { messages } from '../../i18n/messages';
import { brandGradient, dialogPaperSx, ink, primaryActionSx } from '../../theme/brand';
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
    <Dialog
      open={open}
      onClose={close}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="sm"
      aria-labelledby="add-game-title"
      slotProps={{ paper: { sx: (theme) => dialogPaperSx(theme, fullScreen) } }}
    >
      <Box
        component="form"
        onSubmit={continueManual}
        noValidate
        sx={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: fullScreen ? '100%' : undefined,
        }}
      >
        <DialogHeader
          titleId="add-game-title"
          title={t.title}
          eyebrow={messages.library.title}
          icon={<SportsEsportsIcon />}
          onClose={close}
        />
        <Stack spacing={2.5} sx={{ px: 3, pt: 3, pb: 3, flex: 1 }}>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            aria-label={t.modeLabel}
            value={mode}
            onChange={(_e, value: Mode | null) => value && setMode(value)}
            sx={(theme) => ({
              p: 0.5,
              gap: 0.5,
              borderRadius: 99,
              bgcolor: alpha(ink(theme), 0.04),
              border: `1px solid ${alpha(ink(theme), 0.1)}`,
              '& .MuiToggleButton-root': {
                border: 'none',
                borderRadius: '99px !important',
                py: 1,
                gap: 1,
                fontWeight: 700,
                color: 'text.secondary',
              },
              '& .MuiToggleButton-root.Mui-selected': {
                color: theme.palette.common.white,
                background: brandGradient(theme, 110),
                boxShadow: `0 8px 20px -10px ${alpha(theme.palette.primary.main, 0.9)}`,
              },
              '& .MuiToggleButton-root.Mui-selected:hover': {
                background: brandGradient(theme, 110),
              },
            })}
          >
            <ToggleButton value="catalog">
              <SearchIcon fontSize="small" aria-hidden />
              {t.catalogMode}
            </ToggleButton>
            <ToggleButton value="manual">
              <EditNoteIcon fontSize="small" aria-hidden />
              {t.manualMode}
            </ToggleButton>
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
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon color="primary" />
                      </InputAdornment>
                    ),
                  },
                }}
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
        <DialogFooter>
          <Button onClick={close} color="inherit">
            {messages.common.cancel}
          </Button>
          {mode === 'manual' ? (
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={manualName.trim() === ''}
              sx={(theme) => primaryActionSx(theme)}
            >
              {t.continue}
            </Button>
          ) : null}
        </DialogFooter>
      </Box>
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
          sx={(theme) => ({
            maxHeight: { xs: 'none', sm: 340 },
            overflowY: 'auto',
            p: 0.75,
            borderRadius: 2.5,
            bgcolor: alpha(ink(theme), 0.02),
            border: `1px solid ${alpha(ink(theme), 0.07)}`,
          })}
        >
          {data.results.map((result) => {
            const year = formatYear(result.releaseDate);
            const platformNames = result.platforms.map((p) => p.shortName).join(' · ');
            return (
              <ListItemButton
                key={resultKey(result)}
                onClick={() => onSelect(result)}
                sx={(theme) => ({
                  gap: 1.5,
                  borderRadius: 2,
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) },
                  '& + &': { mt: 0.25 },
                })}
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
