import NewspaperIcon from '@mui/icons-material/Newspaper';
import SearchIcon from '@mui/icons-material/Search';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { type ReactNode, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { type Choice, ChoiceChips } from '../components/ChoiceChips';
import { useNews } from '../features/explore/api';
import { ExploreHeader, LoadMoreButton, StatePanel } from '../features/explore/ExploreLayout';
import { NewsCard } from '../features/explore/NewsCard';
import type { NewsFilter } from '../features/explore/types';
import { SectionHeading } from '../features/home/SectionHeading';
import { useLocale } from '../i18n/locale';
import { messages } from '../i18n/messages';
import { useDebouncedValue } from '../lib/useDebouncedValue';

const t = messages.news;
const FILTERS: NewsFilter[] = ['playstation', 'xbox', 'nintendo', 'pc', 'general'];
const FEATURED_COUNT = 3;

const NEWS_GRID_SX = {
  display: 'grid',
  gap: { xs: 3, md: 3.5 },
  gridTemplateColumns: {
    xs: '1fr',
    sm: 'repeat(2, minmax(0, 1fr))',
    lg: 'repeat(3, minmax(0, 1fr))',
  },
} as const;

/**
 * Gaming news (decision #67): headlines from the configured feeds, filtered by
 * platform family and searchable, linking to the original articles. Public.
 */
export function NewsPage() {
  const [params, setParams] = useSearchParams();
  const categoryParam = params.get('category') as NewsFilter | null;
  const category = categoryParam && FILTERS.includes(categoryParam) ? categoryParam : undefined;
  const [search, setSearch] = useState(params.get('q') ?? '');
  const q = useDebouncedValue(search.trim(), 350);
  const locale = useLocale();
  const news = useNews(category, q);

  // The search box drives the URL (shareable), debounced.
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (q) {
      next.set('q', q);
    } else {
      next.delete('q');
    }
    if (next.toString() !== params.toString()) {
      setParams(next, { replace: true });
    }
  }, [q, params, setParams]);

  const first = news.data?.pages[0];
  const articles = news.data?.pages.flatMap((page) => page.items) ?? [];
  // Featured: the latest articles with an image, only on the unfiltered first view.
  const showFeatured = !category && !q;
  const featured = showFeatured
    ? articles.filter((article) => article.imageUrl).slice(0, FEATURED_COUNT)
    : [];
  const featuredIds = new Set(featured.map((article) => article.id));
  const rest = articles.filter((article) => !featuredIds.has(article.id));

  const categoryChoices: Choice<NewsFilter | 'all'>[] = [
    { value: 'all', label: t.categories.all },
    ...FILTERS.map((value) => ({ value, label: t.categories[value] })),
  ];

  let content: ReactNode;
  if (news.isPending) {
    content = (
      <Box sx={NEWS_GRID_SX} aria-busy="true" aria-label={messages.app.loading}>
        {Array.from({ length: 6 }, (_, i) => (
          <Box key={i}>
            <Skeleton variant="rounded" sx={{ aspectRatio: '16 / 9', height: 'auto' }} />
            <Skeleton width="85%" sx={{ mt: 1 }} />
            <Skeleton width="60%" />
          </Box>
        ))}
      </Box>
    );
  } else if (news.isError) {
    content = (
      <Alert
        severity="error"
        variant="outlined"
        action={
          <Button color="inherit" size="small" onClick={() => void news.refetch()}>
            {messages.errors.retry}
          </Button>
        }
      >
        {messages.explore.loadError}
      </Alert>
    );
  } else if (first && !first.configured) {
    content = (
      <StatePanel
        icon={<SettingsSuggestIcon />}
        title={t.notConfiguredTitle}
        body={t.notConfiguredBody}
      />
    );
  } else if (first && !first.available) {
    content = <StatePanel body={t.unavailable} />;
  } else if (articles.length === 0) {
    content = <StatePanel body={t.empty} icon={<NewspaperIcon />} />;
  } else {
    content = (
      <Stack spacing={{ xs: 4, md: 5 }}>
        {featured.length > 0 ? (
          <Box component="section" aria-labelledby="news-featured">
            <Typography
              id="news-featured"
              variant="overline"
              component="h2"
              sx={{ fontWeight: 800, letterSpacing: 1.8 }}
              color="primary"
            >
              {t.featured}
            </Typography>
            <Box
              sx={{
                mt: 1,
                display: 'grid',
                gap: { xs: 2, md: 2.5 },
                gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
                gridTemplateRows: { md: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              {featured.map((article, index) => (
                <Box
                  key={article.id}
                  sx={{ gridRow: { md: index === 0 ? 'span 2' : 'auto' }, minWidth: 0 }}
                >
                  <NewsCard article={article} variant="feature" />
                </Box>
              ))}
            </Box>
          </Box>
        ) : null}
        <Box component="section" aria-labelledby="news-latest">
          {featured.length > 0 ? (
            <SectionHeading id="news-latest" eyebrow={t.eyebrow} title={t.latest} />
          ) : (
            <Typography id="news-latest" component="h2" sx={visuallyHidden}>
              {t.latest}
            </Typography>
          )}
          <Box
            component="ul"
            sx={{
              ...NEWS_GRID_SX,
              listStyle: 'none',
              m: 0,
              p: 0,
              mt: featured.length > 0 ? 2.5 : 0,
            }}
          >
            {rest.map((article) => (
              <Box component="li" key={article.id} sx={{ minWidth: 0 }}>
                <NewsCard article={article} />
              </Box>
            ))}
          </Box>
        </Box>
        {news.hasNextPage ? (
          <LoadMoreButton
            onClick={() => void news.fetchNextPage()}
            loading={news.isFetchingNextPage}
          />
        ) : null}
      </Stack>
    );
  }

  return (
    <Stack spacing={{ xs: 4, md: 5 }}>
      <ExploreHeader
        id="news-title"
        eyebrow={t.eyebrow}
        title={t.title}
        accent={t.titleAccent}
        body={t.body}
        icon={<NewspaperIcon />}
      >
        {first?.configured ? (
          <Stack spacing={0.25}>
            <Typography variant="caption" color="text.secondary">
              {t.sources(first.sources.join(', '))}
            </Typography>
            {first.language !== locale ? (
              <Typography variant="caption" color="text.secondary">
                {t.otherLanguage}
              </Typography>
            ) : null}
          </Stack>
        ) : null}
      </ExploreHeader>

      {first?.configured !== false ? (
        <Stack
          component="form"
          role="search"
          aria-label={t.search}
          spacing={2}
          onSubmit={(e) => e.preventDefault()}
        >
          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.search}
            size="small"
            slotProps={{
              htmlInput: { 'aria-label': t.search, maxLength: 100 },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="primary" />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ maxWidth: 520, '& .MuiOutlinedInput-root': { borderRadius: 99 } }}
          />
          <ChoiceChips
            id="news-category"
            label={t.category}
            value={category ?? 'all'}
            choices={categoryChoices}
            onChange={(value) => {
              const next = new URLSearchParams(params);
              if (value === 'all') {
                next.delete('category');
              } else {
                next.set('category', value);
              }
              setParams(next, { replace: true });
            }}
          />
          {first && first.failedSources.length > 0 && first.available ? (
            <Alert severity="info" variant="outlined">
              {t.failedSources(first.failedSources.join(', '))}
            </Alert>
          ) : null}
        </Stack>
      ) : null}

      {content}
    </Stack>
  );
}

const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;
