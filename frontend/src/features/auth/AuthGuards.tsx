import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { Navigate, Outlet, useLocation } from 'react-router';
import { messages } from '../../i18n/messages';
import { useCurrentUser } from './useCurrentUser';

interface RedirectState {
  from?: { pathname: string; search?: string };
}

function CenteredLoader() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
      <CircularProgress aria-label={messages.app.loading} />
    </Box>
  );
}

/** Renders child routes only for logged-in users; otherwise sends them to /login. */
export function RequireAuth() {
  const location = useLocation();
  const { data: user, isPending, isError } = useCurrentUser();

  if (isPending) {
    return <CenteredLoader />;
  }
  if (isError) {
    return (
      <Alert severity="error" variant="outlined">
        {messages.errors.network}
      </Alert>
    );
  }
  if (!user) {
    const state: RedirectState = { from: { pathname: location.pathname, search: location.search } };
    return <Navigate to="/login" replace state={state} />;
  }
  return <Outlet />;
}

/** Login/register are only for logged-out users; logged-in users go back where they came from. */
export function RedirectIfAuthenticated() {
  const location = useLocation();
  const { data: user, isPending } = useCurrentUser();

  if (isPending) {
    return <CenteredLoader />;
  }
  if (user) {
    const from = (location.state as RedirectState | null)?.from;
    return <Navigate to={from ? `${from.pathname}${from.search ?? ''}` : '/'} replace />;
  }
  return <Outlet />;
}
