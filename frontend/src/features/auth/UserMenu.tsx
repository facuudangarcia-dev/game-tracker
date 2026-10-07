import AccountCircle from '@mui/icons-material/AccountCircle';
import Logout from '@mui/icons-material/Logout';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { messages } from '../../i18n/messages';
import type { User } from './api';
import { useLogout } from './useAuthMutations';

export function UserMenu({ user }: { user: User }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const logout = useLogout();

  return (
    <>
      <IconButton
        aria-label={messages.auth.userMenu}
        aria-haspopup="menu"
        aria-expanded={anchor ? 'true' : undefined}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        <AccountCircle />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <Box sx={{ px: 2, py: 1, maxWidth: 280, overflowWrap: 'anywhere' }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {user.username}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {user.email}
          </Typography>
        </Box>
        <Divider />
        <MenuItem
          disabled={logout.isPending}
          onClick={() => {
            setAnchor(null);
            logout.mutate();
          }}
        >
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          {messages.auth.logout}
        </MenuItem>
      </Menu>
    </>
  );
}
