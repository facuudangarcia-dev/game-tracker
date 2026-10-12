import Stack from '@mui/material/Stack';
import { useCurrentUser } from '../features/auth/useCurrentUser';
import { useMemo, useState } from 'react';
import { GLOBAL_SEARCH_INPUT_ID } from '../features/catalog/GlobalSearch';
import { useCatalogHighlights } from '../features/catalog/queries';
import { RecommendationsRail } from '../features/explore/RecommendationsRail';
import { FeatureBento } from '../features/home/FeatureBento';
import { RecentReleasesRail, UpcomingReleasesRail } from '../features/home/GameRail';
import { HomeDealsModule, HomeNewsModule } from '../features/home/HomeExploreModules';
import { HomeHero } from '../features/home/HomeHero';
import { HomeSteps } from '../features/home/HomeSteps';
import { pickFeatured } from '../features/home/homeFormat';

/** Focuses the global catalog search in the header. */
function focusGlobalSearch() {
  document.getElementById(GLOBAL_SEARCH_INPUT_ID)?.focus();
}

/**
 * Presentation and entry point of the app: a showcase of the catalog (recent and
 * upcoming games, recommendations), compact news and deals modules linking to
 * their pages, and what Game Tracker records.
 */
export function HomePage() {
  const { data: user, isPending: userPending } = useCurrentUser();
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
    <Stack spacing={{ xs: 6, md: 9 }} sx={{ minWidth: 0 }}>
      <HomeHero
        featured={featured}
        onExplore={focusGlobalSearch}
        anonymous={!userPending && !user}
      />
      {showRecent ? (
        <RecentReleasesRail games={recent} loading={loading} viewAllTo="/discover" />
      ) : null}
      <RecommendationsRail variant="home" />
      <FeatureBento />
      {showUpcoming ? (
        <UpcomingReleasesRail games={upcoming} loading={loading} viewAllTo="/releases" />
      ) : null}
      <HomeNewsModule />
      <HomeDealsModule />
      <HomeSteps />
    </Stack>
  );
}
