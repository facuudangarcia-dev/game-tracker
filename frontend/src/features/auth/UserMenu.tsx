import Logout from '@mui/icons-material/Logout';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { alpha } from '@mui/material/styles';
import { messages } from '../../i18n/messages';
import { VIOLET } from '../../theme/brand';
import { PlayerAvatar } from '../profile/PlayerAvatar';
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
        sx={{ p: 0.5 }}
      >
        {/* The player's avatar inside a thin gradient ring. */}
        <Box
          sx={(theme) => ({
            p: '2px',
            borderRadius: '50%',
            background: `conic-gradient(from 210deg, ${theme.palette.primary.main}, ${VIOLET}, ${theme.palette.secondary.main}, ${theme.palette.primary.main})`,
            boxShadow: `0 0 14px -4px ${alpha(theme.palette.primary.main, 0.9)}`,
          })}
        >
          <Box sx={{ p: '2px', borderRadius: '50%', bgcolor: 'background.default' }}>
            <PlayerAvatar avatar={user.avatar} username={user.username} size={30} decorative />
          </Box>
        </Box>
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
