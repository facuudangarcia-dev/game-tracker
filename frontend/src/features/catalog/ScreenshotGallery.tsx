import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { type KeyboardEvent, useState } from 'react';
import { messages } from '../../i18n/messages';
import { panelSx } from '../../theme/brand';

const t = messages.catalog;
/** Thumbnails shown in the page; the rest are reachable from the viewer. */
const VISIBLE = 6;

type Screenshot = { thumbnailUrl: string; fullUrl: string };

/** Grid of screenshots; opens a full-size viewer with previous/next navigation. */
export function ScreenshotGallery({
  name,
  screenshots,
}: {
  name: string;
  screenshots: Screenshot[];
}) {
  const [open, setOpen] = useState<number | null>(null);
  const total = screenshots.length;
  const visible = screenshots.slice(0, VISIBLE);
  const hidden = total - visible.length;

  const go = (step: number) =>
    setOpen((current) => (current === null ? null : (current + step + total) % total));
  const handleKey = (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight') go(1);
    if (event.key === 'ArrowLeft') go(-1);
  };

  return (
    <Box
      component="section"
      aria-labelledby="catalog-screenshots"
      sx={(theme) => ({ ...panelSx(theme), p: { xs: 2.5, md: 3 } })}
    >
      <Typography
        id="catalog-screenshots"
        variant="overline"
        color="primary"
        component="h2"
        sx={{ fontWeight: 800, letterSpacing: 1.8 }}
      >
        {t.screenshots}
      </Typography>
      <Box
        sx={{
          mt: 1.5,
          display: 'grid',
          gap: 1.25,
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' },
        }}
      >
        {visible.map((screenshot, index) => {
          const isLast = index === visible.length - 1 && hidden > 0;
          return (
            <ButtonBase
              key={screenshot.thumbnailUrl}
              aria-label={t.openScreenshot(index + 1, total)}
              onClick={() => setOpen(index)}
              sx={(theme) => ({
                position: 'relative',
                aspectRatio: '16 / 9',
                borderRadius: 2,
                overflow: 'hidden',
                bgcolor: 'action.hover',
                '& img': { transition: 'transform .35s ease' },
                '&:hover img, &.Mui-focusVisible img': { transform: 'scale(1.06)' },
                '&.Mui-focusVisible': {
                  outline: `2px solid ${theme.palette.primary.main}`,
                  outlineOffset: 2,
                },
              })}
            >
              <Box
                component="img"
                src={screenshot.thumbnailUrl}
                alt=""
                loading="lazy"
                sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              {isLast ? (
                <Box
                  aria-hidden
                  sx={(theme) => ({
                    position: 'absolute',
                    inset: 0,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: alpha(theme.palette.background.default, 0.65),
                    fontSize: '1.5rem',
                    fontWeight: 900,
                  })}
                >
                  {t.moreScreenshots(hidden)}
                </Box>
              ) : null}
            </ButtonBase>
          );
        })}
      </Box>

      <Dialog
        open={open !== null}
        onClose={() => setOpen(null)}
        maxWidth="lg"
        fullWidth
        onKeyDown={handleKey}
        aria-labelledby="screenshot-viewer-caption"
        slotProps={{
          paper: {
            sx: { bgcolor: 'common.black', backgroundImage: 'none', borderRadius: 3, m: 1 },
          },
        }}
      >
        {open !== null ? (
          <Box sx={{ position: 'relative' }}>
            <Box
              component="img"
              src={screenshots[open].fullUrl}
              alt={`${name} — ${t.screenshotOf(open + 1, total)}`}
              sx={{ width: '100%', maxHeight: '85vh', objectFit: 'contain', display: 'block' }}
            />
            <IconButton
              aria-label={messages.common.close}
              onClick={() => setOpen(null)}
              sx={viewerButtonSx({ top: 8, right: 8 })}
            >
              <CloseIcon />
            </IconButton>
            {total > 1 ? (
              <>
                <IconButton
                  aria-label={t.previous}
                  onClick={() => go(-1)}
                  sx={viewerButtonSx({ left: 8, top: '50%', transform: 'translateY(-50%)' })}
                >
                  <ChevronLeftIcon />
                </IconButton>
                <IconButton
                  aria-label={t.next}
                  onClick={() => go(1)}
                  sx={viewerButtonSx({ right: 8, top: '50%', transform: 'translateY(-50%)' })}
                >
                  <ChevronRightIcon />
                </IconButton>
              </>
            ) : null}
            <Typography
              id="screenshot-viewer-caption"
              variant="caption"
              sx={(theme) => ({
                position: 'absolute',
                left: 12,
                bottom: 10,
                px: 1,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.common.black, 0.6),
              })}
            >
              {t.screenshotOf(open + 1, total)}
            </Typography>
          </Box>
        ) : null}
      </Dialog>
    </Box>
  );
}

function viewerButtonSx(position: object) {
  return {
    position: 'absolute',
    ...position,
    color: 'common.white',
    bgcolor: 'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(6px)',
    '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' },
  } as const;
}
