import BookmarksIcon from '@mui/icons-material/Bookmarks';
import EventIcon from '@mui/icons-material/Event';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import type { ReactElement } from 'react';
import { useLocation } from 'react-router';

type ExploreLabel = 'discover' | 'releases' | 'news' | 'deals' | 'wishlist';

export interface ExploreItem {
  to: string;
  label: ExploreLabel;
  icon: ReactElement;
  /** Only with a session. */
  personal?: boolean;
}

/** The Explore sections (decisions #64-#67); labels are read at render time (locale). */
export const EXPLORE_ITEMS: ExploreItem[] = [
  { to: '/discover', label: 'discover', icon: <TravelExploreIcon /> },
  { to: '/releases', label: 'releases', icon: <EventIcon /> },
  { to: '/news', label: 'news', icon: <NewspaperIcon /> },
  { to: '/deals', label: 'deals', icon: <LocalOfferIcon /> },
  { to: '/wishlist', label: 'wishlist', icon: <BookmarksIcon />, personal: true },
];

export function exploreItems(loggedIn: boolean): ExploreItem[] {
  return EXPLORE_ITEMS.filter((item) => loggedIn || !item.personal);
}

/** True on any Explore page (the menu button looks active). */
export function useIsExploreActive(): boolean {
  const { pathname } = useLocation();
  return EXPLORE_ITEMS.some((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));
}
