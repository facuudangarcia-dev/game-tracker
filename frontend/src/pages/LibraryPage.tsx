import AddIcon from '@mui/icons-material/Add';
import TuneIcon from '@mui/icons-material/Tune';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { alpha, useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { type ReactNode, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { catalogGamePath } from '../features/catalog/queries';
import { type AddGameConfig, AddGameDialog } from '../features/library/AddGameDialog';
import { AddToLibraryDialog } from '../features/library/AddToLibraryDialog';
import { LibraryCard } from '../features/library/LibraryCard';
import {
  activeFilterCount,
  filtersFromParams,
  hasActiveFilters,
  paramsFromFilters,
} from '../features/library/libraryFilters';
import { SteamPanel } from '../features/steam/SteamPanel';
import { LibraryFiltersPanel } from '../features/library/LibraryFiltersPanel';
import { LibrarySearch } from '../features/library/LibrarySearch';
import { useLibrary } from '../features/library/queries';
import type { LibraryFilters, UserGameListItem } from '../features/library/types';
import { messages } from '../i18n/messages';
import { ambientBackground, brandGradient, gradientTextSx, ink, panelSx } from '../theme/brand';

const t = messages.library;
/** Poster grid: as many columns as fit, never narrower than this. */
const GRID_SX = {
  display: 'grid',
  gap: { xs: 1.5, sm: 2 },
  gridTemplateColumns: {
    xs: 'repeat(2, minmax(0, 1fr))',
    sm: 'repeat(auto-fill, minmax(165px, 1fr))',
  },
} as const;
const FAN_SIZE = 5;

/** Fanned stack of the library's covers, decorating the banner. */
function CoverFan({ items }: { items: UserGameListItem[] }) {
  const covers = items.filter((item) => item.game.coverUrl).slice(0, FAN_SIZE);
  if (covers.length === 0) {
    return null;
  }
  const middle = (covers.length - 1) / 2;
  return (
    <Box
      aria-hidden
      sx={{
        position: 'relative',
        width: 300,
        height: 190,
        flexShrink: 0,
        display: { xs: 'none', md: 'block' },
      }}
    >
      {covers.map((item, index) => {
        const offset = index - middle;
        return (
          <Box
            key={item.id}
            component="img"
            src={item.game.coverUrl ?? undefined}
            alt=""
            sx={(theme) => ({
              position: 'absolute',
              left: '50%',
              bottom: 0,
              width: 112,
              aspectRatio: '3 / 4',
              objectFit: 'cover',
              borderRadius: 2,
              border: `2px solid ${alpha(ink(theme), 0.1)}`,
              boxShadow: `0 18px 30px -12px rgba(0,0,0,0.8)`,
              transformOrigin: '50% 120%',
              transform: `translateX(-50%) translateX(${offset * 46}px) rotate(${offset * 8}deg) translateY(${Math.abs(offset) * 8}px)`,
              zIndex: 10 - Math.abs(Math.round(offset)),
            })}
          />
        );
      })}
    </Box>
  );
}

function EmptyState({ title, body, action }: { title: string; body: string; action: ReactNode }) {
  return (
    <Box
      sx={(theme) => ({
        ...panelSx(theme),
        p: { xs: 4, md: 6 },
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1.5,
      })}
    >
      <Box
        aria-hidden
        sx={(theme) => ({
          width: 64,
          height: 64,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          color: 'primary.main',
          background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.3)}, transparent 70%)`,
        })}
      >
        <SportsEsportsIcon sx={{ fontSize: 36 }} />
      </Box>
      <Typography variant="h6" component="h2" sx={{ fontWeight: 800 }}>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 420 }}>
        {body}
      </Typography>
      <Box sx={{ mt: 1 }}>{action}</Box>
    </Box>
  );
}

/** "Mis juegos": banner + search on top, filters on the side, posters in the middle. */
export function LibraryPage() {
  const [params, setParams] = useSearchParams();
  const filters = filtersFromParams(params);
  const library = useLibrary(filters);
  // Unfiltered list (same cache entry when no filter is active) for the banner fan.
  const all = useLibrary({});
  const [adding, setAdding] = useState(false);
  const [configuring, setConfiguring] = useState<AddGameConfig | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchKey, setSearchKey] = useState(0);
  const navigate = useNavigate();
  const isMobile = useMediaQuery(useTheme().breakpoints.down('md'));

  const setFilters = (next: LibraryFilters) =>
    setParams(paramsFromFilters(next), { replace: true });
  const clearFilters = () => {
    setSearchKey((key) => key + 1);
    setFilters({ sort: filters.sort, order: filters.order });
  };

  const addButton = (
    <Button
      variant="contained"
      size="large"
      startIcon={<AddIcon />}
      onClick={() => setAdding(true)}
      sx={(theme) => ({
        background: brandGradient(theme, 110),
        color: theme.palette.common.white,
        fontWeight: 800,
        boxShadow: `0 12px 28px -12px ${alpha(theme.palette.primary.main, 0.9)}`,
        '&:hover': { background: brandGradient(theme, 110), filter: 'brightness(1.08)' },
      })}
    >
      {t.addGame}
    </Button>
  );

  const filtersPanel = (
    <LibraryFiltersPanel
      filters={filters}
      onChange={setFilters}
      onClear={() => {
        clearFilters();
        setFiltersOpen(false);
      }}
    />
  );

  let content: ReactNode;
  if (library.isPending) {
    content = (
      <Box sx={GRID_SX} aria-busy="true" aria-label={messages.app.loading}>
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton
            key={i}
            variant="rounded"
            sx={{ aspectRatio: '3 / 4', height: 'auto', borderRadius: 2.5 }}
          />
        ))}
      </Box>
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
        action={<Button onClick={clearFilters}>{t.filters.clear}</Button>}
      />
    ) : (
      <EmptyState title={t.emptyTitle} body={t.emptyBody} action={addButton} />
    );
  } else {
    content = (
      <Box sx={GRID_SX}>
        {library.data.map((item) => (
          <LibraryCard key={item.id} item={item} />
        ))}
      </Box>
    );
  }

  const count = library.data && !library.isError ? t.resultCount(library.data.length) : null;

  return (
    <Stack spacing={{ xs: 3, md: 4 }}>
      {/* Banner: title, count, add button and a fan of the library's covers. */}
      <Box
        component="section"
        aria-labelledby="library-title"
        sx={(theme) => ({
          position: 'relative',
          overflow: 'hidden',
          borderRadius: { xs: 3, md: 4 },
          border: `1px solid ${alpha(ink(theme), 0.08)}`,
          background: ambientBackground(theme),
          px: { xs: 2.5, sm: 4, md: 5 },
          pt: { xs: 3, md: 4 },
          pb: { xs: 3, md: 4 },
        })}
      >
        <Stack
          direction="row"
          sx={{ alignItems: 'flex-end', justifyContent: 'space-between', gap: 3 }}
        >
          <Stack spacing={1.5} sx={{ alignItems: 'flex-start', minWidth: 0 }}>
            <Typography
              variant="overline"
              color="primary"
              sx={{ fontWeight: 700, letterSpacing: 2, lineHeight: 1.5 }}
            >
              {t.eyebrow}
            </Typography>
            <Typography
              id="library-title"
              variant="h3"
              component="h1"
              sx={(theme) => ({
                fontWeight: 900,
                letterSpacing: -1,
                lineHeight: 1.05,
                fontSize: { xs: '2.1rem', md: '2.9rem' },
                '& span': gradientTextSx(theme),
              })}
            >
              <span>{t.title}</span>
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 480 }}>
              {t.heroBody}
            </Typography>
            <Stack
              direction="row"
              spacing={2}
              sx={{ alignItems: 'center', pt: 0.5, flexWrap: 'wrap', rowGap: 1 }}
            >
              {addButton}
              {count ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  aria-live="polite"
                  sx={{ fontWeight: 600 }}
                >
                  {count}
                </Typography>
              ) : null}
            </Stack>
          </Stack>
          <CoverFan items={all.data ?? []} />
        </Stack>
      </Box>

      <SteamPanel />

      {/* Search: wide and centered, the main way into the library. */}
      <Stack direction="row" spacing={1.5} sx={{ width: '100%', alignItems: 'center' }}>
        <LibrarySearch key={searchKey} filters={filters} onChange={setFilters} />
        {isMobile ? (
          <Button
            variant="outlined"
            startIcon={<TuneIcon />}
            onClick={() => setFiltersOpen(true)}
            sx={{ flexShrink: 0, height: 52, borderRadius: 99 }}
          >
            {t.filters.open(activeFilterCount(filters))}
          </Button>
        ) : null}
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '250px minmax(0, 1fr)' },
          gap: { xs: 2, md: 4 },
          alignItems: 'start',
        }}
      >
        {!isMobile ? (
          <Box
            component="aside"
            aria-label={t.filters.title}
            sx={(theme) => ({
              ...panelSx(theme),
              p: 2.5,
              position: 'sticky',
              top: 88,
            })}
          >
            {filtersPanel}
          </Box>
        ) : null}

        <Stack spacing={2} sx={{ minWidth: 0 }}>
          {library.isFetching && !library.isPending ? (
            <LinearProgress aria-label={t.updating} sx={{ borderRadius: 1 }} />
          ) : null}
          {content}
        </Stack>
      </Box>

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          slotProps={{
            paper: {
              sx: (theme) => ({
                ...panelSx(theme),
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                maxHeight: '85vh',
                p: 2.5,
              }),
            },
          }}
        >
          <Typography variant="h6" component="h2" sx={{ fontWeight: 800, mb: 2 }}>
            {t.filters.title}
          </Typography>
          {filtersPanel}
          <Button variant="contained" sx={{ mt: 3 }} onClick={() => setFiltersOpen(false)}>
            {t.filters.showResults}
          </Button>
        </Drawer>
      ) : null}

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
