import { createTheme } from '@mui/material/styles';

/** Dark-first theme. Business-specific tokens (status colors, rating) come later. */
export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#7c9cff' },
    secondary: { main: '#ffb74d' },
    background: {
      default: '#0f1115',
      paper: '#171a21',
    },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: ['Roboto', 'system-ui', '-apple-system', 'Segoe UI', 'Arial', 'sans-serif'].join(
      ',',
    ),
  },
  components: {
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'transparent' },
      styleOverrides: {
        root: ({ theme }) => ({
          borderBottom: `1px solid ${theme.palette.divider}`,
          backdropFilter: 'blur(8px)',
        }),
      },
    },
  },
});
