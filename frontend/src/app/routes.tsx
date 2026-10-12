import type { RouteObject } from 'react-router';
import { RedirectIfAuthenticated, RequireAuth } from '../features/auth/AuthGuards';
import { AppLayout } from '../layouts/AppLayout';
import { CatalogGamePage } from '../pages/CatalogGamePage';
import { DealsPage } from '../pages/DealsPage';
import { DiscoverPage } from '../pages/DiscoverPage';
import { GameDetailPage } from '../pages/GameDetailPage';
import { HomePage } from '../pages/HomePage';
import { LegalPage } from '../pages/LegalPage';
import { LibraryPage } from '../pages/LibraryPage';
import { LoginPage } from '../pages/LoginPage';
import { NewsPage } from '../pages/NewsPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ActivityPage } from '../pages/ActivityPage';
import { FriendsPage } from '../pages/FriendsPage';
import { PlayerGamePage } from '../pages/PlayerGamePage';
import { PlayerPage } from '../pages/PlayerPage';
import { ProfilePage } from '../pages/ProfilePage';
import { RegisterPage } from '../pages/RegisterPage';
import { ReleasesPage } from '../pages/ReleasesPage';
import { RouteErrorPage } from '../pages/RouteErrorPage';
import { VerifyEmailPage } from '../pages/VerifyEmailPage';
import { WishlistPage } from '../pages/WishlistPage';

/**
 * Route tree: Home (/), catalog (/catalog/...), Explore (/discover, /releases,
 * /news, /deals), personal library (/games), wishlist and profile. The Home, the
 * catalog and Explore are public; the library, the wishlist and the profile
 * require a (verified) session.
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
      // Public: the Home and the catalog (logged-in users also see their own data).
      { index: true, element: <HomePage /> },
      // Public catalog page of a game ("this game exists").
      { path: 'catalog/:provider/:externalId', element: <CatalogGamePage /> },
      // Explore (decisions #64-#67): browsing is public; personal actions ask to log in.
      { path: 'discover', element: <DiscoverPage /> },
      { path: 'releases', element: <ReleasesPage /> },
      { path: 'news', element: <NewsPage /> },
      { path: 'deals', element: <DealsPage /> },
      {
        element: <RequireAuth />,
        children: [
          // Personal library ("Mis juegos") and personal detail of a game.
          { path: 'games', element: <LibraryPage /> },
          { path: 'games/:userGameId', element: <GameDetailPage /> },
          { path: 'profile', element: <ProfilePage /> },
          { path: 'wishlist', element: <WishlistPage /> },
          // Social (decisions #84-#86): activity, friends and friends' profiles.
          { path: 'activity', element: <ActivityPage /> },
          { path: 'friends', element: <FriendsPage /> },
          { path: 'u/:username', element: <PlayerPage /> },
          { path: 'u/:username/games/:userGameId', element: <PlayerGamePage /> },
        ],
      },
      // Legal documents: public for everyone (linked from the registration form).
      { path: 'terms', element: <LegalPage document="terms" /> },
      { path: 'privacy', element: <LegalPage document="privacy" /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
