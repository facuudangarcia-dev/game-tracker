import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { genreName } from '../../i18n/genres';
import { messages } from '../../i18n/messages';
import { useCurrentUser } from '../auth/useCurrentUser';
import { Rail } from '../home/GameRail';
import { useRecommendations } from './api';
import { CatalogCard } from './CatalogCard';

interface RecommendationsRailProps {
  /** Home: compact heading and a "See all" link to Discover. */
  variant: 'home' | 'discover';
}

/**
 * Recommended games (decision #64): personalized from the user's favorites,
 * ratings and genres when there's enough data; popular games otherwise.
 * Hidden while the catalog is unavailable or there's nothing to recommend.
 */
export function RecommendationsRail({ variant }: RecommendationsRailProps) {
  const query = useRecommendations();
  const { data: user } = useCurrentUser();
  const t = messages.discover.forYou;
  const data = query.data;

  if (query.isError || (data && (!data.catalogAvailable || data.games.length === 0))) {
    return null;
  }
  const personalized = data?.personalized ?? false;
  const genres = (data?.basedOnGenres ?? []).map(genreName).join(', ');
  const subtitle = personalized ? (genres ? t.basedOn(genres) : t.basedOnGames) : t.generalSubtitle;

  return (
    <Box>
      <Rail
        id={`${variant}-recommendations`}
        eyebrow={variant === 'home' ? messages.home.forYou.eyebrow : t.eyebrow}
        title={
          variant === 'home' ? messages.home.forYou.title : personalized ? t.title : t.generalTitle
        }
        subtitle={subtitle}
        columns={{ xs: 2.3, sm: 3.5, md: 6 }}
        loading={query.isPending}
        skeletonRatio="3 / 4"
        viewAllTo={variant === 'home' ? '/discover' : undefined}
      >
        {(data?.games ?? []).map((game) => (
          <Box component="li" key={game.externalId} sx={{ scrollSnapAlign: 'start', minWidth: 0 }}>
            <CatalogCard game={game} />
          </Box>
        ))}
      </Rail>
      {/* Only users can make them personal by tracking games. */}
      {data && user && !personalized && variant === 'discover' ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: -0.5 }}>
          {t.generalHint}
        </Typography>
      ) : null}
    </Box>
  );
}
