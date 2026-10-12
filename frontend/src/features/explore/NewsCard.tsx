import NewspaperIcon from '@mui/icons-material/Newspaper';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { messages } from '../../i18n/messages';
import { ink, reducedMotion } from '../../theme/brand';
import { formatRelative } from './format';
import type { NewsArticle } from './types';
import { DarkSurface } from '../../theme/DarkSurface';

const t = messages.news;

interface NewsCardProps {
  article: NewsArticle;
  /** `feature`: big image with the text over it. `card`: image on top. `row`: compact (Home). */
  variant?: 'feature' | 'card' | 'row';
  headingLevel?: 'h2' | 'h3';
}

/**
 * A headline linking to the original article (new tab). Only what the feed
 * provides: title, short summary, image, outlet and date.
 */
export function NewsCard({ article, variant = 'card', headingLevel = 'h3' }: NewsCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const image = article.imageUrl && !imageFailed ? article.imageUrl : null;
  const feature = variant === 'feature';
  const row = variant === 'row';
  const when = formatRelative(article.publishedAt);

  const media = (
    <Box
      className="news-media"
      sx={(theme) => ({
        position: feature ? 'absolute' : 'relative',
        inset: feature ? 0 : undefined,
        aspectRatio: feature ? undefined : row ? '1 / 1' : '16 / 9',
        width: row ? 84 : '100%',
        flexShrink: 0,
        overflow: 'hidden',
        borderRadius: feature ? 0 : 2,
        display: 'grid',
        placeItems: 'center',
        color: alpha(ink(theme), 0.35),
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.35)}, ${alpha(theme.palette.secondary.main, 0.2)})`,
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
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            transition: 'transform .4s ease',
            [reducedMotion]: { transition: 'none' },
          }}
        />
      ) : (
        <NewspaperIcon aria-hidden sx={{ fontSize: row ? 30 : 48 }} />
      )}
    </Box>
  );

  const card = (
    <Box
      component="a"
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${article.title}. ${messages.explore.externalLink(t.readAt(article.source))}`}
      sx={(theme) => ({
        position: 'relative',
        display: 'flex',
        flexDirection: row ? 'row' : 'column',
        gap: row ? 1.5 : 1.25,
        height: '100%',
        minHeight: feature ? { xs: 280, md: 360 } : undefined,
        justifyContent: feature ? 'flex-end' : 'flex-start',
        overflow: 'hidden',
        isolation: 'isolate',
        color: 'inherit',
        textDecoration: 'none',
        borderRadius: feature ? 3 : 2,
        p: feature ? { xs: 2.5, md: 3 } : row ? 0.75 : 0,
        border: feature ? `1px solid ${alpha(ink(theme), 0.08)}` : 'none',
        outlineOffset: 3,
        '&:hover .news-media img, &:focus-visible .news-media img': { transform: 'scale(1.05)' },
        '&:hover .news-title, &:focus-visible .news-title': { color: 'primary.light' },
        ...(row
          ? { '&:hover, &:focus-visible': { bgcolor: alpha(theme.palette.primary.main, 0.08) } }
          : {}),
      })}
    >
      {feature ? (
        <Box sx={{ position: 'absolute', inset: 0, zIndex: -1 }}>
          {media}
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(0deg, rgba(8,10,14,0.97) 0%, rgba(8,10,14,0.7) 40%, rgba(8,10,14,0.1) 80%)',
            }}
          />
        </Box>
      ) : (
        media
      )}
      <Stack spacing={0.75} sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 800,
            letterSpacing: 0.6,
            color: 'secondary.main',
            textTransform: 'uppercase',
          }}
          noWrap
        >
          {article.source}
          <Box
            component="span"
            sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'none' }}
          >
            {' · '}
            <time dateTime={article.publishedAt}>{when}</time>
          </Box>
        </Typography>
        <Typography
          className="news-title"
          component={headingLevel}
          sx={{
            fontWeight: 800,
            lineHeight: 1.25,
            fontSize: feature ? { xs: '1.3rem', md: '1.7rem' } : row ? '0.95rem' : '1.05rem',
            transition: 'color .2s ease',
            display: '-webkit-box',
            WebkitLineClamp: row ? 2 : 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {article.title}
        </Typography>
        {article.summary && !row ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: feature ? 2 : 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {article.summary}
          </Typography>
        ) : null}
        {!row ? (
          <Stack
            direction="row"
            spacing={0.5}
            sx={{
              alignItems: 'center',
              color: 'primary.main',
              typography: 'body2',
              fontWeight: 700,
            }}
          >
            <span>{t.readAt(article.source)}</span>
            <OpenInNewIcon aria-hidden sx={{ fontSize: 15 }} />
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
  return feature ? <DarkSurface>{card}</DarkSurface> : card;
}
