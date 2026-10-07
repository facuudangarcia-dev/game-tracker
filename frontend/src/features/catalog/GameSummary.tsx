import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';
import { messages } from '../../i18n/messages';
import { panelSx } from '../../theme/brand';

const t = messages.catalog;

/**
 * Summary panel that adapts to any length: short texts take only their space;
 * long ones get a maximum height with their own scroll and a fade that hints
 * there's more (removed once the end is reached).
 */
export function GameSummary({ summary }: { summary: string | null }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    const measure = () => {
      setOverflowing(element.scrollHeight > element.clientHeight + 1);
      setAtEnd(element.scrollTop + element.clientHeight >= element.scrollHeight - 4);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    element.addEventListener('scroll', measure, { passive: true });
    return () => {
      observer?.disconnect();
      element.removeEventListener('scroll', measure);
    };
  }, [summary]);

  return (
    <Box
      component="section"
      aria-labelledby="catalog-summary"
      sx={(theme) => ({ ...panelSx(theme), p: { xs: 2.5, md: 4 } })}
    >
      <Typography
        id="catalog-summary"
        variant="overline"
        color="primary"
        component="h2"
        sx={{ fontWeight: 800, letterSpacing: 1.8 }}
      >
        {t.summary}
      </Typography>
      {summary ? (
        <>
          <Box sx={{ position: 'relative' }}>
            <Box
              ref={scrollRef}
              data-testid="summary-scroll"
              // Focusable only when it scrolls, so keyboard users can scroll it.
              tabIndex={overflowing ? 0 : undefined}
              role={overflowing ? 'region' : undefined}
              aria-label={overflowing ? t.summary : undefined}
              sx={(theme) => ({
                mt: 1,
                maxHeight: { xs: 340, md: 320 },
                overflowY: 'auto',
                pr: overflowing ? 1.5 : 0,
                scrollbarWidth: 'thin',
                scrollbarColor: `${theme.palette.primary.main} transparent`,
                '&:focus-visible': {
                  outline: `2px solid ${theme.palette.primary.main}`,
                  outlineOffset: 4,
                  borderRadius: 1,
                },
              })}
            >
              <Typography
                sx={{
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  fontSize: { xs: '1rem', md: '1.1rem' },
                  lineHeight: 1.75,
                  color: 'text.primary',
                }}
              >
                {summary}
              </Typography>
            </Box>
            {overflowing && !atEnd ? (
              <Box
                aria-hidden
                sx={(theme) => ({
                  position: 'absolute',
                  left: 0,
                  right: 12,
                  bottom: 0,
                  height: 64,
                  pointerEvents: 'none',
                  background: `linear-gradient(0deg, ${theme.palette.background.paper}, transparent)`,
                })}
              />
            ) : null}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            {t.summaryLanguageNote}
          </Typography>
        </>
      ) : (
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {t.noSummary}
        </Typography>
      )}
    </Box>
  );
}
