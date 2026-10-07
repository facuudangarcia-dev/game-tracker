import Stack from '@mui/material/Stack';
import { useMemo, useState } from 'react';
import { GLOBAL_SEARCH_INPUT_ID } from '../features/catalog/GlobalSearch';
import { useCatalogHighlights } from '../features/catalog/queries';
import { FeatureBento } from '../features/home/FeatureBento';
import { RecentReleasesRail, UpcomingReleasesRail } from '../features/home/GameRail';
import { HomeHero } from '../features/home/HomeHero';
import { HomeSteps } from '../features/home/HomeSteps';
import { pickFeatured } from '../features/home/homeFormat';

/** Focuses the global catalog search in the header. */
function focusGlobalSearch() {
  document.getElementById(GLOBAL_SEARCH_INPUT_ID)?.focus();
}

/**
 * Presentation and entry point of the app: a showcase of the catalog (recent and
 * upcoming games) and of what Game Tracker records. Deliberately not a
 * dashboard: no personal statistics, recent activity or rankings (V2/V3).
 */
export function HomePage() {
  const highlights = useCatalogHighlights();
  // Fixed per visit: the hero game varies between visits, not between renders.
  const [seed] = useState(() => Math.random());

  const recent = highlights.data?.recent ?? [];
  const upcoming = highlights.data?.upcoming ?? [];
  const featured = useMemo(
    () =>
      highlights.data
        ? pickFeatured([...highlights.data.recent, ...highlights.data.upcoming], seed)
        : null,
    [highlights.data, seed],
  );
  const loading = highlights.isPending;
  // Without the catalog the rails are hidden; the hero keeps its abstract backdrop.
  const showRecent = loading || recent.length > 0;
  const showUpcoming = loading || upcoming.length > 0;

  return (
    <Stack spacing={{ xs: 6, md: 9 }}>
      <HomeHero featured={featured} onExplore={focusGlobalSearch} />
      {showRecent ? <RecentReleasesRail games={recent} loading={loading} /> : null}
      <FeatureBento />
      {showUpcoming ? <UpcomingReleasesRail games={upcoming} loading={loading} /> : null}
      <HomeSteps />
    </Stack>
  );
}
