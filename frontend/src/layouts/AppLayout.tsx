import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import AppBar from '@mui/material/AppBar';
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
import { useTheme } from '@mui/material/styles';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useState } from 'react';
import { NavLink, Outlet, Link as RouterLink } from 'react-router';
import { UserMenu } from '../features/auth/UserMenu';
import { useLogout } from '../features/auth/useAuthMutations';
import { useCurrentUser } from '../features/auth/useCurrentUser';
import { GlobalSearch } from '../features/catalog/GlobalSearch';
import { ApiStatusChip } from '../features/health/ApiStatusChip';
import { LanguageSelector } from '../features/locale/LanguageSelector';
import { messages } from '../i18n/messages';

// Labels are looked up at render time so they follow the current language.
const NAV_ITEMS = [
  { to: '/', label: 'home', end: true },
  { to: '/games', label: 'library', end: false },
  { to: '/profile', label: 'profile', end: true },
] as const;

function Logo() {
  return (
    <Link
      component={RouterLink}
      to="/"
      underline="none"
      color="inherit"
      sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}
    >
      <SportsEsportsIcon color="primary" aria-hidden />
      <Typography variant="h6" component="span" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
        {messages.app.name}
      </Typography>
    </Link>
  );
}

/** Compact header: logo, global catalog search and main navigation (drawer on mobile). */
export function AppLayout() {
  const { data: user } = useCurrentUser();
  const isMobile = useMediaQuery(useTheme().breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const logout = useLogout();

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="sticky">
        <Toolbar sx={{ gap: 1.5 }}>
          {user && isMobile ? (
            <IconButton
              edge="start"
              aria-label={messages.nav.openMenu}
              onClick={() => setDrawerOpen(true)}
            >
              <MenuIcon />
            </IconButton>
          ) : null}
          <Logo />
          {user && !isMobile ? (
            <Box sx={{ flex: 1, maxWidth: 520, mx: 2 }}>
              <GlobalSearch />
            </Box>
          ) : null}
          <Box sx={{ flex: 1 }} />
          {user && !isMobile ? (
            <Box component="nav" aria-label={messages.nav.label} sx={{ display: 'flex', gap: 0.5 }}>
              {NAV_ITEMS.map((item) => (
                <Button
                  key={item.to}
                  component={NavLink}
                  to={item.to}
                  end={item.end}
                  color="inherit"
                  sx={{
                    whiteSpace: 'nowrap',
                    color: 'text.secondary',
                    '&.active': { color: 'primary.main', bgcolor: 'action.selected' },
                  }}
                >
                  {messages.nav[item.label]}
                </Button>
              ))}
            </Box>
          ) : null}
          <LanguageSelector />
          {!isMobile ? <ApiStatusChip /> : null}
          {user ? <UserMenu user={user} /> : null}
        </Toolbar>
        {user && isMobile ? (
          <Toolbar variant="dense" sx={{ pb: 1 }}>
            <GlobalSearch />
          </Toolbar>
        ) : null}
      </AppBar>

      {user && isMobile ? (
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
          <Box component="nav" aria-label={messages.nav.label} sx={{ width: 260 }}>
            <Toolbar>
              <Logo />
            </Toolbar>
            <Divider />
            <List>
              {NAV_ITEMS.map((item) => (
                <ListItemButton
                  key={item.to}
                  component={NavLink}
                  to={item.to}
                  end={item.end}
                  onClick={() => setDrawerOpen(false)}
                  sx={{ '&.active': { color: 'primary.main', bgcolor: 'action.selected' } }}
                >
                  <ListItemText primary={messages.nav[item.label]} />
                </ListItemButton>
              ))}
            </List>
            <Divider />
            <List>
              <ListItemButton
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
          </Box>
        </Drawer>
      ) : null}

      <Container component="main" maxWidth="lg" sx={{ flexGrow: 1, py: { xs: 3, md: 5 } }}>
        <Outlet />
      </Container>
    </Box>
  );
}
