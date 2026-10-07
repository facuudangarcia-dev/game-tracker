import type { RouteObject } from 'react-router';
import { RedirectIfAuthenticated, RequireAuth } from '../features/auth/AuthGuards';
import { AppLayout } from '../layouts/AppLayout';
import { CatalogGamePage } from '../pages/CatalogGamePage';
import { GameDetailPage } from '../pages/GameDetailPage';
import { HomePage } from '../pages/HomePage';
import { LibraryPage } from '../pages/LibraryPage';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ProfilePage } from '../pages/ProfilePage';
import { RegisterPage } from '../pages/RegisterPage';
import { RouteErrorPage } from '../pages/RouteErrorPage';

/**
 * Route tree: Home (/), catalog (/catalog/...), personal library (/games) and
 * profile (/profile). Everything but login/register requires a session.
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
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
