import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import { SwordIcon } from '../components/SwordIcon';
import AppBar from '@mui/material/AppBar';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import { alpha, type Theme, useTheme } from '@mui/material/styles';
import Toolbar from '@mui/material/Toolbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useState } from 'react';
import { NavLink, Outlet, Link as RouterLink, useLocation, useMatch } from 'react-router';
import { UserMenu } from '../features/auth/UserMenu';
import { useLogout } from '../features/auth/useAuthMutations';
import { useCurrentUser } from '../features/auth/useCurrentUser';
import { GlobalSearch } from '../features/catalog/GlobalSearch';
import { exploreItems } from '../features/explore/exploreItems';
import { ExploreMenuButton } from '../features/explore/exploreNav';
import { LanguageSelector } from '../features/locale/LanguageSelector';
import { useFriends } from '../features/social/api';
import { CommunityMenuButton } from '../features/social/CommunityMenuButton';
import { LegalUpdateDialog } from '../features/social/LegalUpdateDialog';
import { ThemeSelector } from '../features/theme/ThemeSelector';
import { messages } from '../i18n/messages';
import { brandGradient, gradientTextSx, ink, primaryActionSx, VIOLET } from '../theme/brand';

// Labels are looked up at render time so they follow the current language.
const NAV_ITEMS = [
  { to: '/', label: 'home', end: true },
  { to: '/games', label: 'library', end: false },
  { to: '/activity', label: 'activity', end: true },
  { to: '/friends', label: 'friends', end: false },
  { to: '/profile', label: 'profile', end: true },
] as const;

/** Label of a nav item; "Amigos" carries the count of pending friend requests. */
function NavLabel({
  label,
  pending,
}: {
  label: (typeof NAV_ITEMS)[number]['label'];
  pending: number;
}) {
  if (label !== 'friends' || pending === 0) {
    return <>{messages.nav[label]}</>;
  }
  return (
    <Badge
      badgeContent={pending}
      color="secondary"
      slotProps={{ badge: { 'aria-label': messages.social.friends.pendingBadge(pending) } }}
      sx={{ '& .MuiBadge-badge': { right: -10, top: 2, fontWeight: 800 } }}
    >
      {messages.nav[label]}
    </Badge>
  );
}

/** Brand mark: gamepad in a gradient badge + wordmark with "Tracker" in the gradient. */
function Logo() {
  const [first, ...rest] = messages.app.name.split(' ');
  return (
    <Link
      component={RouterLink}
      to="/"
      underline="none"
      color="inherit"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        flexShrink: 0,
        borderRadius: 2,
        '&:hover .logo-badge': { transform: 'rotate(-8deg) scale(1.05)' },
      }}
    >
      <Box
        className="logo-badge"
        aria-hidden
        sx={(theme) => ({
          width: 34,
          height: 34,
          display: 'grid',
          placeItems: 'center',
          // The sword alone, in the brand gradient with a soft glow.
          filter: `drop-shadow(0 0 6px ${alpha(theme.palette.primary.main, 0.6)})`,
          transition: 'transform .25s ease',
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        })}
      >
        <SwordIcon gradient sx={{ fontSize: 32 }} />
      </Box>
      <Typography
        component="span"
        sx={{
          fontWeight: 900,
          fontSize: '1.2rem',
          letterSpacing: -0.4,
          whiteSpace: 'nowrap',
        }}
      >
        {first}{' '}
        <Box component="span" sx={(theme) => gradientTextSx(theme)}>
          {rest.join(' ')}
        </Box>
      </Typography>
    </Link>
  );
}

/** Navigation pill: subtle at rest; active = tinted with a gradient underline. */
const navButtonSx = (theme: Theme) => ({
  position: 'relative',
  whiteSpace: 'nowrap',
  px: 1.75,
  borderRadius: 99,
  fontWeight: 700,
  letterSpacing: 0.4,
  color: 'text.secondary',
  '&:hover': { color: 'text.primary', bgcolor: alpha(ink(theme), 0.05) },
  '&.active': {
    color: theme.palette.mode === 'dark' ? theme.palette.common.white : theme.palette.primary.dark,
    bgcolor: alpha(theme.palette.primary.main, 0.16),
    boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.35)}`,
  },
  '&.active::after': {
    content: '""',
    position: 'absolute',
    left: '22%',
    right: '22%',
    bottom: -9,
    height: 2,
    borderRadius: 2,
    background: brandGradient(theme, 90),
    boxShadow: `0 0 10px ${alpha(theme.palette.primary.main, 0.9)}`,
  },
});

/** Item of the mobile drawer; active = tinted with a bar on the left. */
const drawerItemSx = (theme: Theme) => ({
  borderRadius: 2,
  mb: 0.5,
  fontWeight: 700,
  '&.active': {
    color: theme.palette.mode === 'dark' ? theme.palette.common.white : theme.palette.primary.dark,
    bgcolor: alpha(theme.palette.primary.main, 0.16),
    boxShadow: `inset 3px 0 0 ${theme.palette.primary.main}`,
  },
});

/**
 * The global search: the theme's field language (border, focus ring), shaped as a
 * pill, with its search icon always in the brand color.
 */
const searchSx = (_theme: Theme) => ({
  '& .MuiOutlinedInput-root': { borderRadius: 99 },
  '& .MuiInputAdornment-root': { color: 'primary.main' },
});

/**
 * Anonymous visitors: "log in" as a quiet pill and "create account" in the brand
 * gradient (on very narrow screens only "log in"; the Home hero offers both).
 */
function GuestActions() {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Button
        component={RouterLink}
        to="/login"
        color="inherit"
        sx={(theme) => ({
          ...navButtonSx(theme),
          color: 'text.primary',
          display: { xs: 'none', sm: 'inline-flex' },
        })}
      >
        {messages.auth.login.title}
      </Button>
      {/* Phones: an icon, so the header fits next to the theme and language controls. */}
      <IconButton
        component={RouterLink}
        to="/login"
        aria-label={messages.auth.login.title}
        sx={{ display: { xs: 'inline-flex', sm: 'none' }, color: 'text.primary' }}
      >
        <LoginRoundedIcon />
      </IconButton>
      <Button
        component={RouterLink}
        to="/register"
        variant="contained"
        sx={(theme) => ({
          ...primaryActionSx(theme),
          px: 2.25,
          borderRadius: 99,
          whiteSpace: 'nowrap',
          display: { xs: 'none', sm: 'inline-flex' },
        })}
      >
        {messages.auth.register.title}
      </Button>
    </Stack>
  );
}

/** Compact header: logo, global catalog search and main navigation (drawer on mobile). */
export function AppLayout() {
  const { data: user, isPending: userPending } = useCurrentUser();
  // The catalog is public: anonymous visitors also get the search.
  const guest = !userPending && !user;
  // The full header (search, nav, community and explore menus) needs about 1400 px.
  const isMobile = useMediaQuery(useTheme().breakpoints.down(1400));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const logout = useLogout();
  // The Home uses the extra width of large monitors (side columns).
  const isHome = useMatch({ path: '/', end: true }) !== null;
  // Explore pages are grids of cards: they use the same width as the Home.
  const { pathname } = useLocation();
  const isExplore = ['/discover', '/releases', '/news', '/deals'].includes(pathname);
  const isProfile = useMatch({ path: '/profile', end: true }) !== null;
  const wide = isHome || isExplore || isProfile;
  const loggedIn = Boolean(user);
  const mainItems = user ? NAV_ITEMS : NAV_ITEMS.filter((item) => item.label === 'home');
  // Pending friend requests, shown on "Amigos" (decision #84).
  const friends = useFriends(loggedIn && !user?.legalAcceptanceRequired);
  const pendingRequests = friends.data?.incoming.length ?? 0;

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar
        position="sticky"
        sx={(theme) => ({
          borderBottom: 'none',
          background: `linear-gradient(180deg, ${alpha(theme.palette.background.default, 0.92)} 0%, ${alpha(theme.palette.background.default, 0.78)} 100%)`,
          backdropFilter: 'blur(14px) saturate(1.4)',
          // Signature line under the header: the brand gradient with a soft glow.
          '&::after': {
            content: '""',
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '1px',
            background: `linear-gradient(90deg, transparent 0%, ${alpha(theme.palette.primary.main, 0.7)} 25%, ${alpha(VIOLET, 0.7)} 55%, ${alpha(theme.palette.secondary.main, 0.6)} 80%, transparent 100%)`,
            boxShadow: `0 0 12px ${alpha(theme.palette.primary.main, 0.5)}`,
          },
        })}
      >
        <Toolbar sx={{ gap: 1.5, minHeight: { md: 68 } }}>
          {(user || guest) && isMobile ? (
            <IconButton
              edge="start"
              aria-label={messages.nav.openMenu}
              onClick={() => setDrawerOpen(true)}
            >
              <Badge variant="dot" color="secondary" invisible={pendingRequests === 0}>
                <MenuIcon />
              </Badge>
            </IconButton>
          ) : null}
          <Logo />
          {(user || guest) && !isMobile ? (
            <Box sx={(theme) => ({ flex: 1, maxWidth: 560, mx: 3, ...searchSx(theme) })}>
              <GlobalSearch />
            </Box>
          ) : null}
          <Box sx={{ flex: 1 }} />
          {(user || guest) && !isMobile ? (
            <Box
              component="nav"
              aria-label={messages.nav.label}
              sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}
            >
              {mainItems
                .filter((item) => item.label !== 'activity' && item.label !== 'friends')
                .flatMap((item) => [
                  <Button
                    key={item.to}
                    component={NavLink}
                    to={item.to}
                    end={item.end}
                    color="inherit"
                    sx={navButtonSx}
                  >
                    {messages.nav[item.label]}
                  </Button>,
                  // Activity and friends share one menu after "Mis juegos".
                  item.label === 'library' ? (
                    <CommunityMenuButton
                      key="community"
                      pending={pendingRequests}
                      buttonSx={navButtonSx}
                    />
                  ) : null,
                ])}
              <ExploreMenuButton loggedIn={loggedIn} buttonSx={navButtonSx} />
            </Box>
          ) : null}
          {user && !isMobile ? (
            <Box
              aria-hidden
              sx={(theme) => ({
                width: '1px',
                height: 24,
                mx: 0.5,
                bgcolor: alpha(ink(theme), 0.12),
              })}
            />
          ) : null}
          <ThemeSelector />
          <LanguageSelector />
          {user ? <UserMenu user={user} /> : null}
          {guest ? <GuestActions /> : null}
        </Toolbar>
        {(user || guest) && isMobile ? (
          <Toolbar variant="dense" sx={(theme) => ({ pb: 1.25, ...searchSx(theme) })}>
            <GlobalSearch />
          </Toolbar>
        ) : null}
      </AppBar>

      {(user || guest) && isMobile ? (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          slotProps={{
            paper: {
              sx: (theme) => ({
                backgroundImage: 'none',
                bgcolor: 'background.default',
                borderRight: `1px solid ${alpha(ink(theme), 0.08)}`,
              }),
            },
          }}
        >
          <Box component="nav" aria-label={messages.nav.label} sx={{ width: 270 }}>
            <Toolbar>
              <Logo />
            </Toolbar>
            <Divider />
            <List sx={{ px: 1.25, py: 1.5 }}>
              {mainItems.map((item) => (
                <ListItemButton
                  key={item.to}
                  component={NavLink}
                  to={item.to}
                  end={item.end}
                  onClick={() => setDrawerOpen(false)}
                  sx={drawerItemSx}
                >
                  <ListItemText
                    primary={<NavLabel label={item.label} pending={pendingRequests} />}
                    slotProps={{ primary: { sx: { fontWeight: 700 } } }}
                  />
                </ListItemButton>
              ))}
            </List>
            <List
              sx={{ px: 1.25, pb: 1.5 }}
              subheader={
                <ListSubheader
                  disableSticky
                  sx={{
                    bgcolor: 'transparent',
                    fontWeight: 800,
                    letterSpacing: 1.2,
                    lineHeight: 2.5,
                    textTransform: 'uppercase',
                  }}
                >
                  {messages.nav.explore}
                </ListSubheader>
              }
            >
              {exploreItems(loggedIn).map((item) => (
                <ListItemButton
                  key={item.to}
                  component={NavLink}
                  to={item.to}
                  onClick={() => setDrawerOpen(false)}
                  sx={drawerItemSx}
                >
                  <ListItemIcon sx={{ minWidth: 38, '& svg': { fontSize: 20 } }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={messages.nav[item.label]}
                    slotProps={{ primary: { sx: { fontWeight: 700 } } }}
                  />
                </ListItemButton>
              ))}
            </List>
            <Divider />
            {user ? (
              <List sx={{ px: 1.25 }}>
                <ListItemButton
                  sx={{ borderRadius: 2 }}
                  onClick={() => {
                    setDrawerOpen(false);
                    logout.mutate();
                  }}
                >
                  <ListItemIcon>
                    <LogoutIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={messages.auth.logout} />
                </ListItemButton>
              </List>
            ) : (
              <Stack spacing={1} sx={{ p: 2 }}>
                <Button
                  component={RouterLink}
                  to="/register"
                  variant="contained"
                  onClick={() => setDrawerOpen(false)}
                  sx={(theme) => ({ ...primaryActionSx(theme), borderRadius: 99 })}
                >
                  {messages.auth.register.title}
                </Button>
                <Button
                  component={RouterLink}
                  to="/login"
                  variant="outlined"
                  onClick={() => setDrawerOpen(false)}
                  sx={{ borderRadius: 99 }}
                >
                  {messages.auth.login.title}
                </Button>
              </Stack>
            )}
          </Box>
        </Drawer>
      ) : null}

      <Container
        component="main"
        maxWidth={wide ? false : 'lg'}
        sx={{
          flexGrow: 1,
          py: { xs: 3, md: 5 },
          // Wide but not endless on huge monitors.
          ...(wide ? { maxWidth: 1600, px: { xs: 2, sm: 3, lg: 4 } } : {}),
        }}
      >
        <Outlet />
      </Container>
      {/* Updated Terms or Privacy policy: accept them to keep going (decision #88). */}
      {user?.legalAcceptanceRequired ? <LegalUpdateDialog /> : null}
    </Box>
  );
}
