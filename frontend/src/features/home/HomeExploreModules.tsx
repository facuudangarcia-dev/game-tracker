import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { Link as RouterLink } from 'react-router';
import { messages } from '../../i18n/messages';
import { useNews, useRecommendedDeals } from '../explore/api';
import { DealCard } from '../explore/DealCard';
import { NewsCard } from '../explore/NewsCard';
import { Rail } from './GameRail';
import { SectionHeading } from './SectionHeading';

const t = messages.home;
const NEWS_ROWS = 4;

/**
 * Featured news for the Home: one big headline and a few compact ones, linking
 * to the News page. Hidden when news aren't configured or can't be read.
 */
export function HomeNewsModule() {
  const news = useNews(undefined, '');
  const page = news.data?.pages[0];
  if (news.isError || (page && (!page.configured || !page.available || page.items.length === 0))) {
    return null;
  }
  const items = page?.items ?? [];
  const lead = items.find((article) => article.imageUrl) ?? items[0];
  const rows = items.filter((article) => article !== lead).slice(0, NEWS_ROWS);

  return (
    <Box component="section" aria-labelledby="home-news">
      <SectionHeading
        id="home-news"
        eyebrow={t.newsModule.eyebrow}
        title={t.newsModule.title}
        actions={
          <Button
            component={RouterLink}
            to="/news"
            endIcon={<ArrowForwardIcon />}
            sx={{ fontWeight: 700, whiteSpace: 'nowrap', borderRadius: 99 }}
          >
            {t.viewAll}
          </Button>
        }
      />
      {news.isPending ? (
        <Skeleton variant="rounded" height={320} sx={{ mt: 2.5 }} />
      ) : (
        <Box
          sx={{
            mt: 2.5,
            display: 'grid',
            gap: { xs: 2, md: 3 },
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.25fr) minmax(0, 1fr)' },
          }}
        >
          {lead ? <NewsCard article={lead} variant="feature" /> : null}
          <Stack component="ul" spacing={0.5} sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {rows.map((article) => (
              <Box component="li" key={article.id}>
                <NewsCard article={article} variant="row" />
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}

/**
 * Recommended deals for the Home: deals of the user's wishlist and pending games
 * first (real matches only), then general ones. Hidden without a price source.
 */
export function HomeDealsModule() {
  const deals = useRecommendedDeals();
  const data = deals.data;
  if (deals.isError || (data && (!data.configured || !data.available || data.items.length === 0))) {
    return null;
  }
  return (
    <Rail
      id="home-deals"
      eyebrow={t.dealsModule.eyebrow}
      title={t.dealsModule.title}
      subtitle={data?.personalized ? t.dealsModule.personalized : t.dealsModule.general}
      columns={{ xs: 1.15, sm: 2.2, md: 4 }}
      loading={deals.isPending}
      skeletonRatio="460 / 215"
      viewAllTo="/deals"
    >
      {(data?.items ?? []).map((deal) => (
        <Box component="li" key={deal.priceGameId} sx={{ scrollSnapAlign: 'start', minWidth: 0 }}>
          <DealCard deal={deal} />
        </Box>
      ))}
    </Rail>
  );
}
