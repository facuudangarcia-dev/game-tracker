import type { RouteObject } from 'react-router';
import { RedirectIfAuthenticated, RequireAuth } from '../features/auth/AuthGuards';
import { AppLayout } from '../layouts/AppLayout';
import { CatalogGamePage } from '../pages/CatalogGamePage';
import { GameDetailPage } from '../pages/GameDetailPage';
import { HomePage } from '../pages/HomePage';
import { LegalPage } from '../pages/LegalPage';
import { LibraryPage } from '../pages/LibraryPage';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ProfilePage } from '../pages/ProfilePage';
import { RegisterPage } from '../pages/RegisterPage';
import { RouteErrorPage } from '../pages/RouteErrorPage';
import { VerifyEmailPage } from '../pages/VerifyEmailPage';

/**
 * Route tree: Home (/), catalog (/catalog/...), personal library (/games) and
 * profile (/profile). Everything but login, register, email verification and the
 * legal documents requires a (verified) session.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <RedirectIfAuthenticated />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
          // Email verification (registration and unverified logins land here).
          { path: 'verify-email', element: <VerifyEmailPage /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          { index: true, element: <HomePage /> },
          // Personal library ("Mis juegos") and personal detail of a game.
          { path: 'games', element: <LibraryPage /> },
          { path: 'games/:userGameId', element: <GameDetailPage /> },
          // Public catalog page of a game ("this game exists").
          { path: 'catalog/:provider/:externalId', element: <CatalogGamePage /> },
          { path: 'profile', element: <ProfilePage /> },
        ],
      },
      // Legal documents: public for everyone (linked from the registration form).
      { path: 'terms', element: <LegalPage document="terms" /> },
      { path: 'privacy', element: <LegalPage document="privacy" /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
