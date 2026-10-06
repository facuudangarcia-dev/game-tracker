import { Navigate, type RouteObject } from 'react-router';
import { RedirectIfAuthenticated, RequireAuth } from '../features/auth/AuthGuards';
import { AppLayout } from '../layouts/AppLayout';
import { GameDetailPage } from '../pages/GameDetailPage';
import { LibraryPage } from '../pages/LibraryPage';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { RegisterPage } from '../pages/RegisterPage';
import { RouteErrorPage } from '../pages/RouteErrorPage';

/** Route tree. "Mis juegos" (/games) is the home of the app. */
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
          { index: true, element: <Navigate to="/games" replace /> },
          { path: 'games', element: <LibraryPage /> },
          { path: 'games/:userGameId', element: <GameDetailPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
