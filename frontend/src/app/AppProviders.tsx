import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Fragment, type ReactNode } from 'react';
import { useLocale } from '../i18n/locale';
import { useColorModePreference } from '../theme/colorMode';
import { darkTheme, lightTheme } from '../theme/theme';

interface AppProvidersProps {
  queryClient: QueryClient;
  children: ReactNode;
}

/**
 * Re-mounts the app when the language changes, so every text is read again from
 * the (updated) messages. Server data stays in the query cache and the URL is kept.
 */
function LocaleBoundary({ children }: { children: ReactNode }) {
  const locale = useLocale();
  return <Fragment key={locale}>{children}</Fragment>;
}

/** The theme in use: the user's choice, or the device's setting (decision #83). */
function useAppTheme() {
  const preference = useColorModePreference();
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true });
  const dark = preference === 'system' ? systemDark : preference === 'dark';
  return dark ? darkTheme : lightTheme;
}

/** Global providers shared by the app and by component tests. */
export function AppProviders({ queryClient, children }: AppProvidersProps) {
  const theme = useAppTheme();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        <LocaleBoundary>{children}</LocaleBoundary>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
