import LogoutIcon from '@mui/icons-material/Logout';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useLogout } from '../features/auth/useAuthMutations';
import { useCurrentUser } from '../features/auth/useCurrentUser';
import { Facts } from '../features/game-detail/sections/MyGameSection';
import { messages } from '../i18n/messages';
import { formatDate } from '../lib/format';

const t = messages.profile;

/** Deliberately simple profile: email and logout (avatar, bio, social... are V3). */
export function ProfilePage() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();

  if (!user) {
    return null;
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 640 }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
        {t.title}
      </Typography>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
        <Stack spacing={3}>
          <Facts
            items={[
              [t.email, user.email],
              [t.memberSince, formatDate(user.createdAt.slice(0, 10))],
            ]}
          />
          <Button
            variant="outlined"
            color="error"
            startIcon={<LogoutIcon />}
            loading={logout.isPending}
            onClick={() => logout.mutate()}
            sx={{ alignSelf: 'flex-start' }}
          >
            {t.logout}
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
