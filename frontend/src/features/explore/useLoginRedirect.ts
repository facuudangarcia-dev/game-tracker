import { useLocation, useNavigate } from 'react-router';
import type { AuthLocationState } from '../auth/authLocation';

/** Sends anonymous visitors to log in, coming back to this page afterwards. */
export function useLoginRedirect(): () => void {
  const navigate = useNavigate();
  const location = useLocation();
  return () =>
    void navigate('/login', {
      state: {
        from: { pathname: location.pathname, search: location.search },
      } satisfies AuthLocationState,
    });
}
