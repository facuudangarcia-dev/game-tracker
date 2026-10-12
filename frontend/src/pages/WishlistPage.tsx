import BookmarksIcon from '@mui/icons-material/Bookmarks';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { type FormEvent, type ReactNode, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { catalogGamePath } from '../features/catalog/queries';
import { useRemoveFromWishlist, useSetTargetPrice, useWishlist } from '../features/explore/api';
import { CutBadge } from '../features/explore/DealCard';
import { countryName } from '../features/explore/countries';
import { ExploreHeader, StatePanel } from '../features/explore/ExploreLayout';
import { PriceCountrySelect } from '../features/explore/PriceCountrySelect';
import { formatMoney, formatShortDate } from '../features/explore/format';
import { PriceHistoryDialog } from '../features/explore/PriceHistoryDialog';
import type { PriceSource, WishlistItem } from '../features/explore/types';
import { GameCover } from '../features/library/GameCover';
import { messages } from '../i18n/messages';
import { getApiErrorMessage } from '../lib/api/errors';
import { panelSx } from '../theme/brand';

const t = messages.wishlist;
const PRICE_PATTERN = /^\d{1,6}([.,]\d{1,2})?$/;

/** Target price form: in the currency of the current price (never converted). */
function TargetPriceForm({ item }: { item: WishlistItem }) {
  const setTarget = useSetTargetPrice();
  const [value, setValue] = useState(item.targetPrice ? String(item.targetPrice.amount) : '');
  const [error, setError] = useState<string | null>(null);
  const currency = item.targetPrice?.currency ?? item.price?.best?.price.currency ?? null;

  if (!currency) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t.targetNeedsPrice}
      </Typography>
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = value.trim();
    const amount = Number(text.replace(',', '.'));
    if (!PRICE_PATTERN.test(text) || amount <= 0) {
      setError(t.targetInvalid);
      return;
    }
    setError(null);
    setTarget.mutate(
      { itemId: item.id, targetPrice: amount },
      { onError: (e) => setError(getApiErrorMessage(e, messages.explore.serverErrors)) },
    );
  };

  return (
    <Stack component="form" onSubmit={submit} noValidate spacing={1}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <TextField
          size="small"
          label={t.targetIn(currency)}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error={error !== null}
          helperText={error ?? undefined}
          slotProps={{ htmlInput: { inputMode: 'decimal', maxLength: 9 } }}
          sx={{ width: 170 }}
        />
        <Button type="submit" variant="outlined" loading={setTarget.isPending} sx={{ mt: '2px' }}>
          {t.setTarget}
        </Button>
      </Stack>
      {item.targetPrice ? (
        <Button
          size="small"
          color="inherit"
          sx={{ alignSelf: 'flex-start', color: 'text.secondary' }}
          onClick={() => {
            setValue('');
            setError(null);
            setTarget.mutate({ itemId: item.id, targetPrice: null });
          }}
        >
          {t.clearTarget}
        </Button>
      ) : null}
    </Stack>
  );
}

function PriceBlock({ item, source }: { item: WishlistItem; source: PriceSource }) {
  // Without a price source the page explains it once, above the list.
  if (!source.configured) {
    return null;
  }
  if (!item.price) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t.pricesUnavailable}
      </Typography>
    );
  }
  const { best, historyLow, reachedTarget } = item.price;
  if (!best) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t.noPrice}
      </Typography>
    );
  }
  return (
    <Stack spacing={0.75}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}
      >
        {t.bestPrice}
      </Typography>
      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography sx={{ fontWeight: 900, fontSize: '1.4rem', lineHeight: 1 }}>
          {formatMoney(best.price)}
        </Typography>
        {best.cut !== null && best.cut > 0 ? (
          <>
            <Typography
              variant="body2"
              color="text.secondary"
              aria-label={messages.deals.regularPrice(formatMoney(best.regular))}
              sx={{ textDecoration: 'line-through' }}
            >
              {formatMoney(best.regular)}
            </Typography>
            <CutBadge cut={best.cut} size="sm" />
          </>
        ) : null}
      </Stack>
      <Link
        href={best.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={messages.deals.viewDealAt(best.shop.name)}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          fontWeight: 700,
          width: 'fit-content',
        }}
      >
        {best.shop.name}
        <OpenInNewIcon sx={{ fontSize: 15 }} aria-hidden />
      </Link>
      {historyLow ? (
        <Typography variant="caption" color="text.secondary">
          {messages.deals.historyLow(formatMoney(historyLow))}
        </Typography>
      ) : null}
      {best.expiry ? (
        <Typography variant="caption" color="secondary.main" sx={{ fontWeight: 700 }}>
          {messages.deals.expires(formatShortDate(best.expiry))}
        </Typography>
      ) : null}
      {item.targetPrice ? (
        reachedTarget === true ? (
          <Stack
            direction="row"
            spacing={0.75}
            sx={(theme) => ({
              alignItems: 'center',
              alignSelf: 'flex-start',
              px: 1.25,
              py: 0.5,
              borderRadius: 99,
              color: 'success.light',
              bgcolor: alpha(theme.palette.success.main, 0.14),
              border: `1px solid ${alpha(theme.palette.success.main, 0.45)}`,
            })}
          >
            <CheckCircleIcon sx={{ fontSize: 18 }} aria-hidden />
            <Typography variant="body2" sx={{ fontWeight: 800 }}>
              {t.reached}
            </Typography>
          </Stack>
        ) : reachedTarget === false ? (
          <Stack
            direction="row"
            spacing={0.5}
            sx={{ alignItems: 'center', color: 'text.secondary' }}
          >
            <TrendingDownIcon sx={{ fontSize: 18 }} aria-hidden />
            <Typography variant="body2">{t.notReached(formatMoney(item.targetPrice))}</Typography>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {t.differentCurrency}
          </Typography>
        )
      ) : null}
    </Stack>
  );
}

function WishlistRow({
  item,
  source,
  onHistory,
  onRemoved,
}: {
  item: WishlistItem;
  source: PriceSource;
  onHistory: () => void;
  onRemoved: () => void;
}) {
  const remove = useRemoveFromWishlist();
  const [error, setError] = useState<string | null>(null);
  const reached = item.price?.reachedTarget === true;

  return (
    <Box
      component="article"
      aria-label={item.game.name}
      sx={(theme) => ({
        ...panelSx(theme, reached ? theme.palette.success.main : theme.palette.primary.main),
        ...(reached ? { borderColor: alpha(theme.palette.success.main, 0.5) } : {}),
        p: { xs: 2, md: 2.5 },
        display: 'grid',
        gap: { xs: 2, md: 3 },
        gridTemplateColumns: {
          xs: '84px minmax(0, 1fr)',
          md: '96px minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr)',
        },
        alignItems: 'start',
      })}
    >
      <Box
        component={RouterLink}
        to={catalogGamePath(item.game.provider, item.game.externalId)}
        sx={{ borderRadius: 1.5, overflow: 'hidden', display: 'block' }}
        aria-label={item.game.name}
      >
        <GameCover src={item.game.coverUrl} name={item.game.name} />
      </Box>
      <Stack spacing={0.75} sx={{ minWidth: 0 }}>
        <Typography
          component={RouterLink}
          to={catalogGamePath(item.game.provider, item.game.externalId)}
          variant="h6"
          sx={{
            fontWeight: 800,
            lineHeight: 1.2,
            color: 'inherit',
            textDecoration: 'none',
            '&:hover': { color: 'primary.light' },
          }}
        >
          {item.game.name}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {item.game.platforms.map((p) => p.shortName).join(' · ')}
        </Typography>
        <Typography variant="caption" color="text.disabled">
          {t.addedOn(formatShortDate(item.createdAt))}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ pt: 0.5 }}>
          <Button
            size="small"
            startIcon={<ShowChartIcon />}
            onClick={onHistory}
            disabled={!source.configured || !item.price?.found}
          >
            {t.history}
          </Button>
          <Button
            size="small"
            color="inherit"
            startIcon={<DeleteOutlineIcon />}
            aria-label={t.removeLabel(item.game.name)}
            loading={remove.isPending}
            onClick={() =>
              remove.mutate(item.id, {
                onSuccess: onRemoved,
                onError: (e) => setError(getApiErrorMessage(e, messages.explore.serverErrors)),
              })
            }
            sx={{ color: 'text.secondary' }}
          >
            {t.remove}
          </Button>
        </Stack>
        {error ? (
          <Alert severity="error" variant="outlined">
            {error}
          </Alert>
        ) : null}
      </Stack>
      <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}>
        <PriceBlock item={item} source={source} />
      </Box>
      <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}>
        {source.configured && item.price ? (
          <TargetPriceForm key={item.targetPrice?.amount ?? 'none'} item={item} />
        ) : null}
      </Box>
    </Box>
  );
}

/** "Mi wishlist" (decision #66): wanted games with their prices and target prices. */
export function WishlistPage() {
  const wishlist = useWishlist();
  const [historyOf, setHistoryOf] = useState<WishlistItem | null>(null);
  const [removed, setRemoved] = useState<string | null>(null);

  let content: ReactNode;
  if (wishlist.isPending) {
    content = (
      <Stack spacing={2} aria-busy="true" aria-label={messages.app.loading}>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} variant="rounded" height={150} />
        ))}
      </Stack>
    );
  } else if (wishlist.isError) {
    content = (
      <Alert
        severity="error"
        variant="outlined"
        action={
          <Button color="inherit" size="small" onClick={() => void wishlist.refetch()}>
            {messages.errors.retry}
          </Button>
        }
      >
        {t.loadError}
      </Alert>
    );
  } else if (wishlist.data.items.length === 0) {
    content = (
      <StatePanel
        icon={<BookmarksIcon />}
        title={t.emptyTitle}
        body={t.emptyBody}
        action={
          <Button
            component={RouterLink}
            to="/discover"
            variant="outlined"
            sx={{ borderRadius: 99 }}
          >
            {t.goDiscover}
          </Button>
        }
      />
    );
  } else {
    const data = wishlist.data;
    content = (
      <Stack spacing={2}>
        {data.configured && !data.available ? (
          <Alert severity="warning" variant="outlined">
            {t.pricesUnavailable}
          </Alert>
        ) : null}
        {!data.configured ? (
          <Alert severity="info" variant="outlined">
            {messages.deals.notConfiguredBody}
          </Alert>
        ) : null}
        <Stack component="ul" spacing={2} sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {data.items.map((item) => (
            <Box component="li" key={item.id}>
              <WishlistRow
                item={item}
                source={data}
                onHistory={() => setHistoryOf(item)}
                onRemoved={() => setRemoved(item.game.name)}
              />
            </Box>
          ))}
        </Stack>
        {data.configured ? (
          <Typography variant="caption" color="text.secondary">
            {messages.deals.attribution}{' '}
            <Link href={data.source.url} target="_blank" rel="noopener noreferrer">
              {data.source.name}
            </Link>
            {'. '}
            {messages.deals.country(countryName(data.country))}
          </Typography>
        ) : null}
      </Stack>
    );
  }

  return (
    <Stack spacing={{ xs: 4, md: 5 }}>
      <ExploreHeader
        id="wishlist-title"
        eyebrow={t.eyebrow}
        title={t.title}
        accent="wishlist"
        body={t.body}
        icon={<BookmarksIcon />}
        aside={
          wishlist.data && wishlist.data.items.length > 0 ? (
            <Typography sx={{ fontWeight: 800 }} color="text.secondary">
              {t.count(wishlist.data.items.length)}
            </Typography>
          ) : undefined
        }
      >
        <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
          <Typography variant="caption" color="text.secondary">
            {t.alertsNote}
          </Typography>
          {wishlist.data?.configured ? (
            <PriceCountrySelect shown={wishlist.data.country} minWidth={220} />
          ) : null}
        </Stack>
      </ExploreHeader>
      {content}
      {historyOf ? (
        <PriceHistoryDialog item={historyOf} onClose={() => setHistoryOf(null)} />
      ) : null}
      <Snackbar
        open={removed !== null}
        autoHideDuration={5000}
        onClose={() => setRemoved(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setRemoved(null)}>
          {removed ? t.removed(removed) : ''}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
