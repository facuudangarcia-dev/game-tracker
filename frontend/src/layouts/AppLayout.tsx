import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { Outlet, Link as RouterLink } from 'react-router';
import { UserMenu } from '../features/auth/UserMenu';
import { useCurrentUser } from '../features/auth/useCurrentUser';
import { ApiStatusChip } from '../features/health/ApiStatusChip';
import { messages } from '../i18n/messages';

export function AppLayout() {
  const { data: user } = useCurrentUser();

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="sticky">
        <Toolbar sx={{ gap: 1.5 }}>
          <SportsEsportsIcon color="primary" aria-hidden />
          <Link component={RouterLink} to="/" underline="none" color="inherit" sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
              {messages.app.name}
            </Typography>
          </Link>
          <ApiStatusChip />
          {user ? <UserMenu user={user} /> : null}
        </Toolbar>
      </AppBar>
      <Container component="main" maxWidth="lg" sx={{ flexGrow: 1, py: { xs: 3, md: 5 } }}>
        <Outlet />
      </Container>
    </Box>
  );
}
