import Box from '@mui/material/Box';
import { ThemeProvider } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { darkTheme } from './theme';

/**
 * Content on top of artwork (covers, hero images with a dark scrim) stays dark
 * in both modes (decision #83): its texts, chips and buttons use the dark theme.
 * Texts inherit their color from the page, so the wrapper also sets it (it
 * doesn't take part in the layout).
 */
export function DarkSurface({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={darkTheme}>
      <Box sx={{ display: 'contents', color: darkTheme.palette.text.primary }}>{children}</Box>
    </ThemeProvider>
  );
}
