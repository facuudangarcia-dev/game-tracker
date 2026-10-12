import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { messages } from '../../i18n/messages';
import { glassSx, ink, reducedMotion } from '../../theme/brand';
import { formatDateTime, formatMoney } from './format';
import type { Deal, RecommendedDeal } from './types';

const t = messages.deals;

interface DealCardProps {
  deal: Deal | RecommendedDeal;
  /** `feature`: bigger, for the featured deals. */
  variant?: 'card' | 'feature';
}

/** Discount badge: computed by the backend from the real prices. */
export function CutBadge({ cut, size = 'md' }: { cut: number; size?: 'sm' | 'md' }) {
  return (
    <Box
      component="span"
      aria-label={t.discount(cut)}
      sx={(theme) => ({
        display: 'inline-block',
        px: size === 'md' ? 1 : 0.75,
        py: 0.25,
        borderRadius: 1,
        fontWeight: 900,
        fontSize: size === 'md' ? '0.95rem' : '0.75rem',
        lineHeight: 1.3,
        color: theme.palette.common.black,
        background: `linear-gradient(110deg, ${theme.palette.success.light}, ${theme.palette.success.main})`,
        boxShadow: `0 6px 16px -8px ${alpha(theme.palette.success.main, 0.9)}`,
      })}
    >
      −{cut}%
    </Box>
  );
}

/**
 * A deal linking to the shop's offer (new tab), as the source reports it: price,
 * previous price, shop, systems, and — only when the source has them — the
 * historical low and the end date.
 */
export function DealCard({ deal, variant = 'card' }: DealCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const feature = variant === 'feature';
  const discounted = deal.cut !== null && deal.cut > 0;
  const reason = 'reason' in deal ? deal.reason : null;
  const image = deal.imageUrl && !imageFailed ? deal.imageUrl : null;

  return (
    <Box
      component="a"
      href={deal.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${deal.title}. ${formatMoney(deal.price)}. ${t.viewDealAt(deal.shop.name)}`}
      sx={(theme) => ({
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        color: 'inherit',
        textDecoration: 'none',
        borderRadius: 2.5,
        border: `1px solid ${alpha(ink(theme), 0.08)}`,
        bgcolor: 'background.paper',
        outlineOffset: 3,
        transition: 'transform .25s ease, box-shadow .25s ease',
        '& img': { transition: 'transform .4s ease' },
        '&:hover, &:focus-visible': {
          transform: 'translateY(-4px)',
          boxShadow: `0 18px 40px -18px ${alpha(theme.palette.success.main, 0.55)}, 0 0 0 1px ${alpha(theme.palette.success.main, 0.5)}`,
        },
        '&:hover img, &:focus-visible img': { transform: 'scale(1.04)' },
        [reducedMotion]: {
          transition: 'none',
          '& img': { transition: 'none' },
          '&:hover, &:hover img': { transform: 'none' },
        },
      })}
    >
      <Box
        sx={(theme) => ({
          position: 'relative',
          aspectRatio: feature ? '16 / 8' : '460 / 215',
          overflow: 'hidden',
          display: 'grid',
          placeItems: 'center',
          color: alpha(ink(theme), 0.35),
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.35)}, ${alpha(theme.palette.success.main, 0.18)})`,
        })}
      >
        {image ? (
          <Box
            component="img"
            src={image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <LocalOfferIcon aria-hidden sx={{ fontSize: 44 }} />
        )}
        {discounted ? (
          <Box sx={{ position: 'absolute', top: 10, left: 10 }}>
            <CutBadge cut={deal.cut!} />
          </Box>
        ) : null}
        {reason ? (
          <Box
            component="span"
            sx={(theme) => ({
              ...glassSx(theme, 0.7),
              position: 'absolute',
              top: 10,
              right: 10,
              px: 1,
              py: 0.25,
              borderRadius: 99,
              typography: 'caption',
              fontWeight: 800,
              color: reason === 'wishlist' ? 'secondary.main' : 'info.main',
            })}
          >
            {t.reasons[reason]}
          </Box>
        ) : null}
      </Box>

      <Stack spacing={1} sx={{ p: feature ? 2.25 : 1.75, flex: 1 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          noWrap
          sx={{ fontWeight: 700, letterSpacing: 0.4 }}
        >
          {[deal.shop.name, deal.platforms.join(' · ')].filter(Boolean).join(' — ')}
        </Typography>
        <Typography
          component="h3"
          sx={{
            fontWeight: 800,
            lineHeight: 1.25,
            fontSize: feature ? '1.2rem' : '1rem',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {deal.title}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', flexWrap: 'wrap' }}>
          <Typography
            sx={{
              fontWeight: 900,
              fontSize: feature ? '1.6rem' : '1.3rem',
              color: discounted ? 'success.light' : 'text.primary',
            }}
          >
            {formatMoney(deal.price)}
          </Typography>
          {discounted ? (
            <Typography
              variant="body2"
              color="text.secondary"
              aria-label={t.regularPrice(formatMoney(deal.regular))}
              sx={{ textDecoration: 'line-through' }}
            >
              {formatMoney(deal.regular)}
            </Typography>
          ) : null}
        </Stack>
        <Stack spacing={0.25} sx={{ mt: 'auto !important' }}>
          {deal.voucher ? (
            <Typography variant="caption" color="warning.main" sx={{ fontWeight: 700 }}>
              {t.voucher(deal.voucher)}
            </Typography>
          ) : null}
          {deal.historyLow ? (
            <Typography variant="caption" color="text.secondary">
              {t.historyLow(formatMoney(deal.historyLow))}
            </Typography>
          ) : null}
          {deal.expiry ? (
            <Typography variant="caption" color="secondary.main" sx={{ fontWeight: 700 }}>
              {t.expires(formatDateTime(deal.expiry))}
            </Typography>
          ) : null}
          <Typography variant="caption" color="text.disabled">
            {t.recordedAt(formatDateTime(deal.timestamp))}
          </Typography>
        </Stack>
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ alignItems: 'center', color: 'primary.main', typography: 'body2', fontWeight: 700 }}
        >
          <span>{t.viewDeal}</span>
          <OpenInNewIcon aria-hidden sx={{ fontSize: 15 }} />
        </Stack>
      </Stack>
    </Box>
  );
}
