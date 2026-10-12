import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { useCatalogHighlights } from '../features/catalog/queries';
import { useDiscover } from '../features/explore/api';
import { CatalogCard } from '../features/explore/CatalogCard';
import {
  ExploreHeader,
  FilterSelect,
  LoadMoreButton,
  StatePanel,
} from '../features/explore/ExploreLayout';
import { POSTER_GRID_SX } from '../features/explore/styles';
import { RecommendationsRail } from '../features/explore/RecommendationsRail';
import type { DiscoverFilters, DiscoverSort } from '../features/explore/types';
import { RecentReleasesRail, UpcomingReleasesRail } from '../features/home/GameRail';
import { SectionHeading } from '../features/home/SectionHeading';
import { useGenres, usePlatforms } from '../features/library/queries';
import { genreName } from '../i18n/genres';
import { messages } from '../i18n/messages';

const t = messages.discover;
const SORTS: DiscoverSort[] = ['popular', 'top-rated', 'newest', 'anticipated'];
const FIRST_YEAR = 1990;

function filtersFromParams(params: URLSearchParams): DiscoverFilters {
  const sort = params.get('sort');
  return {
    platform: params.get('platform') ?? undefined,
    genre: params.get('genre') ?? undefined,
    release: params.get('release') ?? undefined,
    sort: SORTS.includes(sort as DiscoverSort) ? (sort as DiscoverSort) : undefined,
  };
}

/** Year options of the release filter: next year down to 1990. */
function releaseOptions(): [string, string][] {
  const thisYear = new Date().getFullYear();
  const years: [string, string][] = [];
  for (let year = thisYear + 1; year >= FIRST_YEAR; year--) {
    years.push([String(year), String(year)]);
  }
  return [
    ['', t.releaseOptions.any],
    ['upcoming', t.releaseOptions.upcoming],
    ['recent', t.releaseOptions.recent],
    ...years,
  ];
}

/**
 * Discover (decision #64): featured and upcoming games (the Home's rails),
 * recommendations, and the catalog with filters. Public; cards link to the
 * existing catalog page.
 */
export function DiscoverPage() {
  const [params, setParams] = useSearchParams();
  const filters = filtersFromParams(params);
  const highlights = useCatalogHighlights();
  const discover = useDiscover(filters);
  const platforms = usePlatforms();
  const genres = useGenres();

  const setFilter = (key: keyof DiscoverFilters, value: string) => {
    const next = new URLSearchParams(params);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setParams(next, { replace: true });
  };
  const hasFilters = Boolean(filters.platform || filters.genre || filters.release || filters.sort);

  const recent = highlights.data?.recent ?? [];
  const upcoming = highlights.data?.upcoming ?? [];
  const games = discover.data?.pages.flatMap((page) => page.games) ?? [];
  const unavailable = discover.data?.pages.some((page) => !page.catalogAvailable) ?? false;
  const defaultSort = filters.release === 'upcoming' ? 'anticipated' : 'popular';

  let grid: ReactNode;
  if (discover.isPending) {
    grid = (
      <Box sx={POSTER_GRID_SX} aria-busy="true" aria-label={messages.app.loading}>
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} variant="rounded" sx={{ aspectRatio: '3 / 4', height: 'auto' }} />
        ))}
      </Box>
    );
  } else if (discover.isError) {
    grid = (
      <Alert
        severity="error"
        variant="outlined"
        action={
          <Button color="inherit" size="small" onClick={() => void discover.refetch()}>
            {messages.errors.retry}
          </Button>
        }
      >
        {messages.explore.loadError}
      </Alert>
    );
  } else if (unavailable) {
    grid = <StatePanel body={messages.explore.catalogUnavailable} />;
  } else if (games.length === 0) {
    grid = (
      <StatePanel
        body={t.noResults}
        action={
          hasFilters ? (
            <Button onClick={() => setParams(new URLSearchParams(), { replace: true })}>
              {messages.explore.clearFilters}
            </Button>
          ) : undefined
        }
      />
    );
  } else {
    grid = (
      <Stack spacing={3}>
        <Box component="ul" sx={{ ...POSTER_GRID_SX, listStyle: 'none', m: 0, p: 0 }}>
          {games.map((game) => (
            <Box component="li" key={game.externalId} sx={{ minWidth: 0 }}>
              <CatalogCard game={game} />
            </Box>
          ))}
        </Box>
        {discover.hasNextPage ? (
          <LoadMoreButton
            onClick={() => void discover.fetchNextPage()}
            loading={discover.isFetchingNextPage}
          />
        ) : null}
      </Stack>
    );
  }

  return (
    <Stack spacing={{ xs: 5, md: 7 }}>
      <ExploreHeader
        id="discover-title"
        eyebrow={t.eyebrow}
        title={t.title}
        accent={t.titleAccent}
        body={t.body}
        icon={<TravelExploreIcon />}
      />

      <RecommendationsRail variant="discover" />

      {highlights.isPending || recent.length > 0 ? (
        <RecentReleasesRail games={recent} loading={highlights.isPending} />
      ) : null}
      {highlights.isPending || upcoming.length > 0 ? (
        <UpcomingReleasesRail
          games={upcoming}
          loading={highlights.isPending}
          viewAllTo="/releases"
        />
      ) : null}

      <Box component="section" aria-labelledby="discover-catalog">
        <SectionHeading
          id="discover-catalog"
          eyebrow={t.catalog.eyebrow}
          title={t.catalog.title}
          subtitle={t.catalog.subtitle}
        />
        <Stack
          component="form"
          role="search"
          aria-label={t.catalog.title}
          direction="row"
          useFlexGap
          onSubmit={(e) => e.preventDefault()}
          sx={{ flexWrap: 'wrap', gap: 1.5, mt: 2.5, mb: 3, alignItems: 'center' }}
        >
          <FilterSelect
            label={messages.explore.platform}
            value={filters.platform ?? ''}
            onChange={(value) => setFilter('platform', value)}
            options={[
              ['', messages.explore.allPlatforms],
              ...(platforms.data ?? []).map((p): [string, string] => [p.slug, p.name]),
            ]}
          />
          <FilterSelect
            label={messages.explore.genre}
            value={filters.genre ?? ''}
            onChange={(value) => setFilter('genre', value)}
            options={[
              ['', messages.explore.allGenres],
              ...(genres.data ?? [])
                .map((g): [string, string] => [g.slug, genreName(g)])
                .sort((a, b) => a[1].localeCompare(b[1])),
            ]}
          />
          <FilterSelect
            label={t.release}
            value={filters.release ?? ''}
            onChange={(value) => setFilter('release', value)}
            options={releaseOptions()}
            minWidth={150}
          />
          <FilterSelect
            label={t.sort}
            value={filters.sort ?? defaultSort}
            onChange={(value) => setFilter('sort', value === defaultSort ? '' : value)}
            options={SORTS.map((sort): [string, string] => [sort, t.sorts[sort]])}
            minWidth={160}
          />
          {hasFilters ? (
            <Button onClick={() => setParams(new URLSearchParams(), { replace: true })}>
              {messages.explore.clearFilters}
            </Button>
          ) : null}
        </Stack>
        {grid}
      </Box>
    </Stack>
  );
}
