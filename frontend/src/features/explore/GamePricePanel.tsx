import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { messages } from '../../i18n/messages';
import { panelSx } from '../../theme/brand';
import { useGamePrices } from './api';
import { countryName } from './countries';
import { CutBadge } from './DealCard';
import { formatMoney } from './format';
import { PriceCountrySelect } from './PriceCountrySelect';

const t = messages.deals;

/**
 * Current PC prices of a catalog game (decision #69), in the user's country,
 * which can be changed here (decision #75). Only shown when the source has the
 * game: nothing is shown otherwise (consoles aren't covered, so most
 * console-only games simply have no panel). Once shown, it stays when another
 * country has no prices, so the user can switch back.
 */
export function GamePricePanel({ provider, externalId }: { provider: string; externalId: string }) {
  const prices = useGamePrices(provider, externalId);
  const data = prices.data;
  const hasPrices = Boolean(data?.available && data.found && data.deals.length > 0);
  const [shown, setShown] = useState(false);
  if (hasPrices && !shown) {
    setShown(true);
  }
  if (!data || (!hasPrices && !shown)) {
    return null;
  }
  const [best, ...others] = hasPrices ? data.deals : [];
  const discounted = best ? best.cut !== null && best.cut > 0 : false;

  return (
    <Box
      component="section"
      aria-labelledby="catalog-price"
      sx={(theme) => ({ ...panelSx(theme, theme.palette.success.main), p: { xs: 2.5, md: 3 } })}
    >
      <Typography
        id="catalog-price"
        variant="overline"
        component="h2"
        sx={{ fontWeight: 800, letterSpacing: 1.8, color: 'success.main' }}
      >
        {t.gamePrice.title}
      </Typography>
      <Box sx={{ mt: 1, mb: 2, display: 'flex', '& > *': { flex: 1 } }}>
        <PriceCountrySelect shown={data.country} />
      </Box>
      {best ? (
        <>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '1.9rem', fontWeight: 900, lineHeight: 1.1 }}>
              {formatMoney(best.price)}
            </Typography>
            {discounted ? <CutBadge cut={best.cut!} /> : null}
          </Stack>
          {discounted ? (
            <Typography
              variant="body2"
              color="text.secondary"
              aria-label={t.regularPrice(formatMoney(best.regular))}
              sx={{ textDecoration: 'line-through' }}
            >
              {formatMoney(best.regular)}
            </Typography>
          ) : null}
          <Button
            href={best.url}
            target="_blank"
            rel="noopener noreferrer"
            variant="contained"
            color="success"
            endIcon={<OpenInNewIcon />}
            aria-label={t.viewDealAt(best.shop.name)}
            sx={{ mt: 1.5, borderRadius: 99 }}
          >
            {t.gamePrice.buyAt(best.shop.name)}
          </Button>
          {data.historyLow ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              {t.historyLow(formatMoney(data.historyLow))}
            </Typography>
          ) : null}

          {others.length > 0 ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {t.gamePrice.otherShops}
              </Typography>
              <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                {others.map((deal) => (
                  <Box
                    component="li"
                    key={deal.shop.id}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 1,
                      py: 0.75,
                      borderTop: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <Link
                      href={deal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t.viewDealAt(deal.shop.name)}
                      underline="hover"
                      color="inherit"
                    >
                      {deal.shop.name}
                    </Link>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {formatMoney(deal.price)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          ) : null}
        </>
      ) : (
        <Typography variant="body2" color="text.secondary" role="status">
          {data.available ? t.gamePrice.notFound(countryName(data.country)) : t.unavailable}
        </Typography>
      )}

      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
        {t.gamePrice.note(countryName(data.country))}{' '}
        <Link href={data.source.url} target="_blank" rel="noopener noreferrer">
          {data.source.name}
        </Link>
      </Typography>
    </Box>
  );
}
