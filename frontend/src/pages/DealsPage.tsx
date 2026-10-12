import BookmarksIcon from '@mui/icons-material/Bookmarks';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { type ReactNode, useEffect, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router';
import { type Choice, ChoiceChips } from '../components/ChoiceChips';
import { useCurrentUser } from '../features/auth/useCurrentUser';
import { useDeals, useShops } from '../features/explore/api';
import { DealCard } from '../features/explore/DealCard';
import {
  ExploreHeader,
  FilterSelect,
  LoadMoreButton,
  StatePanel,
} from '../features/explore/ExploreLayout';
import { countryName } from '../features/explore/countries';
import { formatDateTime } from '../features/explore/format';
import { PriceCountrySelect } from '../features/explore/PriceCountrySelect';
import type { DealsFilters, DealsPlatform, DealsSort, DealsType } from '../features/explore/types';
import { messages } from '../i18n/messages';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { panelSx } from '../theme/brand';

const t = messages.deals;
const SORTS: DealsSort[] = ['relevance', 'cut', 'price'];
const PLATFORMS: DealsPlatform[] = ['windows', 'mac', 'linux'];
const TYPES: DealsType[] = ['game', 'dlc', 'other'];
const MIN_CUTS = [25, 50, 75, 90];
const FEATURED_COUNT = 3;
const PRICE_PATTERN = /^\d{1,6}([.,]\d{1,2})?$/;

const DEALS_GRID_SX = {
  display: 'grid',
  gap: { xs: 2, md: 2.5 },
  gridTemplateColumns: {
    xs: '1fr',
    sm: 'repeat(2, minmax(0, 1fr))',
    md: 'repeat(auto-fill, minmax(250px, 1fr))',
  },
} as const;

function filtersFromParams(params: URLSearchParams): DealsFilters {
  const sort = params.get('sort') as DealsSort | null;
  const platform = params.get('platform') as DealsPlatform | null;
  const type = params.get('type') as DealsType | null;
  const shop = Number(params.get('shop'));
  const minCut = Number(params.get('minCut'));
  const maxPrice = Number(params.get('maxPrice'));
  return {
    sort: sort && SORTS.includes(sort) ? sort : undefined,
    platform: platform && PLATFORMS.includes(platform) ? platform : undefined,
    type: type && TYPES.includes(type) ? type : undefined,
    shop: Number.isInteger(shop) && shop > 0 ? shop : undefined,
    minCut: MIN_CUTS.includes(minCut) ? minCut : undefined,
    maxPrice: maxPrice > 0 ? maxPrice : undefined,
  };
}

/**
 * Deals (decision #66): current prices and discounts from the price source,
 * with filters, sorting and featured deals. Public; nothing is shown without a
 * real source.
 */
export function DealsPage() {
  const { data: user } = useCurrentUser();
  const [params, setParams] = useSearchParams();
  const filters = filtersFromParams(params);
  const deals = useDeals(filters);
  const shops = useShops();
  const [maxPriceText, setMaxPriceText] = useState(params.get('maxPrice') ?? '');
  const maxPriceInput = useDebouncedValue(maxPriceText.trim(), 500);
  const maxPriceValid = maxPriceText.trim() === '' || PRICE_PATTERN.test(maxPriceText.trim());

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setParams(next, { replace: true });
  };

  // The max price box drives the URL once the user stops typing.
  useEffect(() => {
    const value = PRICE_PATTERN.test(maxPriceInput) ? maxPriceInput.replace(',', '.') : '';
    if (value !== (params.get('maxPrice') ?? '') && (value || maxPriceInput === '')) {
      setFilter('maxPrice', value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the typed value settles
  }, [maxPriceInput]);

  const first = deals.data?.pages[0];
  const items = deals.data?.pages.flatMap((page) => page.items) ?? [];
  const unfiltered =
    !filters.sort &&
    !filters.platform &&
    !filters.type &&
    !filters.shop &&
    !filters.minCut &&
    !filters.maxPrice;
  const featured = unfiltered
    ? items.filter((deal) => deal.imageUrl && (deal.cut ?? 0) > 0).slice(0, FEATURED_COUNT)
    : [];
  const featuredIds = new Set(featured.map((deal) => deal.priceGameId));
  const rest = items.filter((deal) => !featuredIds.has(deal.priceGameId));
  const notConfigured = first ? !first.configured : false;

  const sortChoices: Choice<DealsSort>[] = SORTS.map((value) => ({ value, label: t.sorts[value] }));

  let content: ReactNode;
  if (deals.isPending) {
    content = (
      <Box sx={DEALS_GRID_SX} aria-busy="true" aria-label={messages.app.loading}>
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} variant="rounded" sx={{ height: 300 }} />
        ))}
      </Box>
    );
  } else if (deals.isError) {
    content = (
      <Alert
        severity="error"
        variant="outlined"
        action={
          <Button color="inherit" size="small" onClick={() => void deals.refetch()}>
            {messages.errors.retry}
          </Button>
        }
      >
        {messages.explore.loadError}
      </Alert>
    );
  } else if (notConfigured) {
    content = (
      <StatePanel
        icon={<SettingsSuggestIcon />}
        title={t.notConfiguredTitle}
        body={t.notConfiguredBody}
      />
    );
  } else if (first && !first.available) {
    content = <StatePanel body={t.unavailable} />;
  } else if (items.length === 0) {
    content = (
      <StatePanel
        icon={<LocalOfferIcon />}
        body={t.empty}
        action={
          unfiltered ? undefined : (
            <Button
              onClick={() => {
                setMaxPriceText('');
                setParams(new URLSearchParams(), { replace: true });
              }}
            >
              {messages.explore.clearFilters}
            </Button>
          )
        }
      />
    );
  } else {
    content = (
      <Stack spacing={{ xs: 4, md: 5 }}>
        {featured.length > 0 ? (
          <Box component="section" aria-labelledby="deals-featured">
            <Typography
              id="deals-featured"
              variant="overline"
              component="h2"
              color="primary"
              sx={{ fontWeight: 800, letterSpacing: 1.8 }}
            >
              {t.featured}
            </Typography>
            <Box
              component="ul"
              sx={{
                listStyle: 'none',
                m: 0,
                p: 0,
                mt: 1,
                display: 'grid',
                gap: { xs: 2, md: 2.5 },
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
              }}
            >
              {featured.map((deal) => (
                <Box component="li" key={deal.priceGameId} sx={{ minWidth: 0 }}>
                  <DealCard deal={deal} variant="feature" />
                </Box>
              ))}
            </Box>
          </Box>
        ) : null}
        <Box component="section" aria-labelledby="deals-all">
          <Typography
            id="deals-all"
            variant="overline"
            component="h2"
            color="primary"
            sx={{ fontWeight: 800, letterSpacing: 1.8 }}
          >
            {t.all}
          </Typography>
          <Box component="ul" sx={{ ...DEALS_GRID_SX, listStyle: 'none', m: 0, p: 0, mt: 1 }}>
            {rest.map((deal) => (
              <Box component="li" key={deal.priceGameId} sx={{ minWidth: 0 }}>
                <DealCard deal={deal} />
              </Box>
            ))}
          </Box>
        </Box>
        {deals.hasNextPage ? (
          <LoadMoreButton
            onClick={() => void deals.fetchNextPage()}
            loading={deals.isFetchingNextPage}
          />
        ) : null}
        {first?.fetchedAt ? (
          <Typography variant="caption" color="text.secondary">
            {messages.explore.updatedAt(formatDateTime(first.fetchedAt))}
          </Typography>
        ) : null}
      </Stack>
    );
  }

  return (
    <Stack spacing={{ xs: 4, md: 5 }}>
      <ExploreHeader
        id="deals-title"
        eyebrow={t.eyebrow}
        title={t.title}
        accent={t.titleAccent}
        body={t.body}
        icon={<LocalOfferIcon />}
        aside={
          user ? (
            <Button
              component={RouterLink}
              to="/wishlist"
              variant="outlined"
              startIcon={<BookmarksIcon />}
              sx={{ borderRadius: 99 }}
            >
              {t.myWishlist}
            </Button>
          ) : undefined
        }
      >
        {first?.configured ? (
          <Stack spacing={0.25}>
            <Typography variant="caption" color="text.secondary">
              {t.attribution}{' '}
              <Link href={first.source.url} target="_blank" rel="noopener noreferrer">
                {first.source.name}
              </Link>
              {'. '}
              {t.country(countryName(first.country))}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t.pcOnly}
            </Typography>
          </Stack>
        ) : null}
      </ExploreHeader>

      {!notConfigured ? (
        <Box
          component="form"
          role="search"
          aria-label={t.title}
          onSubmit={(e) => e.preventDefault()}
          sx={(theme) => ({ ...panelSx(theme), p: { xs: 2, md: 2.5 } })}
        >
          <Stack spacing={2}>
            <ChoiceChips
              id="deals-sort"
              label={t.sort}
              value={filters.sort ?? 'relevance'}
              choices={sortChoices}
              onChange={(value) => setFilter('sort', value === 'relevance' ? '' : value)}
            />
            <Stack
              direction="row"
              useFlexGap
              sx={{ flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start' }}
            >
              <PriceCountrySelect shown={first?.country} />
              <FilterSelect
                label={t.shop}
                value={filters.shop ? String(filters.shop) : ''}
                onChange={(value) => setFilter('shop', value)}
                options={[
                  ['', t.allShops],
                  ...(shops.data?.shops ?? []).map((shop): [string, string] => [
                    String(shop.id),
                    shop.name,
                  ]),
                ]}
              />
              <FilterSelect
                label={t.platform}
                value={filters.platform ?? ''}
                onChange={(value) => setFilter('platform', value)}
                options={[
                  ['', t.platforms.any],
                  ...PLATFORMS.map((p): [string, string] => [p, t.platforms[p]]),
                ]}
                minWidth={140}
              />
              <FilterSelect
                label={t.type}
                value={filters.type ?? ''}
                onChange={(value) => setFilter('type', value)}
                options={[
                  ['', t.types.any],
                  ...TYPES.map((type): [string, string] => [type, t.types[type]]),
                ]}
                minWidth={140}
              />
              <FilterSelect
                label={t.minCut}
                value={filters.minCut ? String(filters.minCut) : ''}
                onChange={(value) => setFilter('minCut', value)}
                options={[
                  ['', t.minCutOptions.any],
                  ...MIN_CUTS.map((cut): [string, string] => [
                    String(cut),
                    t.minCutOptions.value(cut),
                  ]),
                ]}
                minWidth={160}
              />
              <TextField
                size="small"
                label={t.maxPrice}
                value={maxPriceText}
                onChange={(e) => setMaxPriceText(e.target.value)}
                error={!maxPriceValid}
                helperText={maxPriceValid ? t.maxPriceHelp : messages.wishlist.targetInvalid}
                slotProps={{
                  htmlInput: { inputMode: 'decimal', maxLength: 9 },
                  inputLabel: { shrink: true },
                }}
                sx={{ width: { xs: '100%', sm: 180 } }}
              />
              {!unfiltered ? (
                <Button
                  onClick={() => {
                    setMaxPriceText('');
                    setParams(new URLSearchParams(), { replace: true });
                  }}
                >
                  {messages.explore.clearFilters}
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </Box>
      ) : null}

      {content}
    </Stack>
  );
}
