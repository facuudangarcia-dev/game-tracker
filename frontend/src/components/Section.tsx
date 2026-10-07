import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import type { Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { panelSx } from '../theme/brand';

interface SectionProps {
  id: string;
  title: string;
  /** Actions shown next to the heading. */
  actions?: ReactNode;
  /** Icon shown in a tinted badge before the title. */
  icon?: ReactNode;
  /** Accent color of the panel wash and the icon badge (primary by default). */
  accent?: (theme: Theme) => string;
  children: ReactNode;
}

/** A titled section of a page (landmark with its own heading), in Game Tracker's panel style. */
export function Section({ id, title, actions, icon, accent, children }: SectionProps) {
  const headingId = `${id}-title`;
  return (
    <Box
      component="section"
      id={id}
      aria-labelledby={headingId}
      sx={(theme) => ({
        ...panelSx(theme, accent?.(theme)),
        p: { xs: 2.25, md: 3 },
        scrollMarginTop: 80,
        minWidth: 0,
      })}
    >
      <Stack
        direction="row"
        spacing={1.25}
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2.25,
          flexWrap: 'wrap',
          rowGap: 1,
        }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}>
          {icon ? (
            <Box
              aria-hidden
              sx={(theme) => {
                const color = accent?.(theme) ?? theme.palette.primary.main;
                return {
                  width: 34,
                  height: 34,
                  flexShrink: 0,
                  borderRadius: 1.75,
                  display: 'grid',
                  placeItems: 'center',
                  color,
                  bgcolor: alpha(color, 0.14),
                  boxShadow: `0 0 16px -6px ${alpha(color, 0.9)}`,
                  '& svg': { fontSize: 19 },
                };
              }}
            >
              {icon}
            </Box>
          ) : null}
          <Typography
            id={headingId}
            variant="h6"
            component="h2"
            sx={{ fontWeight: 800, letterSpacing: -0.2 }}
          >
            {title}
          </Typography>
        </Stack>
        {actions ? (
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            {actions}
          </Stack>
        ) : null}
      </Stack>
      {children}
    </Box>
  );
}
