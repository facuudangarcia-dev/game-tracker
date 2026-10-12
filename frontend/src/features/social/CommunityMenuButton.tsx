import DynamicFeedIcon from '@mui/icons-material/DynamicFeed';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { alpha, type Theme } from '@mui/material/styles';
import { type ReactNode, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { messages } from '../../i18n/messages';
import { ink } from '../../theme/brand';

const ITEMS: { to: string; label: 'activity' | 'friends'; icon: ReactNode }[] = [
  { to: '/activity', label: 'activity', icon: <DynamicFeedIcon /> },
  { to: '/friends', label: 'friends', icon: <PeopleAltOutlinedIcon /> },
];

function PendingBadge({ count, children }: { count: number; children: ReactNode }) {
  return (
    <Badge
      badgeContent={count}
      color="secondary"
      invisible={count === 0}
      slotProps={{ badge: { 'aria-label': messages.social.friends.pendingBadge(count) } }}
      // Room for the count, so it doesn't cover the menu's chevron.
      sx={{ mr: count ? 1.5 : 0, '& .MuiBadge-badge': { right: -10, top: 2, fontWeight: 800 } }}
    >
      {children}
    </Badge>
  );
}

/**
 * "Comunidad" in the header (decisions #84 and #86): activity and friends in
 * one menu, so the header keeps room for the search. It shows the pending
 * friend requests.
 */
export function CommunityMenuButton({
  pending,
  buttonSx,
}: {
  pending: number;
  buttonSx: (theme: Theme) => object;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const { pathname } = useLocation();
  const active = ['/activity', '/friends', '/u/'].some((path) => pathname.startsWith(path));

  return (
    <>
      <Button
        color="inherit"
        id="community-menu-button"
        aria-haspopup="menu"
        aria-controls={anchor ? 'community-menu' : undefined}
        aria-expanded={anchor ? 'true' : undefined}
        endIcon={
          <ExpandMoreIcon
            sx={{ transition: 'transform .2s ease', transform: anchor ? 'rotate(180deg)' : 'none' }}
          />
        }
        className={active ? 'active' : undefined}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={buttonSx}
      >
        <PendingBadge count={pending}>{messages.nav.community}</PendingBadge>
      </Button>
      <Menu
        id="community-menu"
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{
          list: { 'aria-labelledby': 'community-menu-button' },
          paper: {
            sx: (theme) => ({
              mt: 1,
              minWidth: 290,
              borderRadius: 3,
              border: `1px solid ${alpha(ink(theme), 0.1)}`,
              backgroundImage: `linear-gradient(160deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${theme.palette.background.paper} 45%)`,
            }),
          },
        }}
      >
        {ITEMS.map((item) => (
          <MenuItem
            key={item.to}
            component={NavLink}
            to={item.to}
            onClick={() => setAnchor(null)}
            sx={(theme) => ({
              py: 1,
              mx: 0.75,
              borderRadius: 2,
              '&.active': {
                bgcolor: alpha(theme.palette.primary.main, 0.16),
                '& .MuiListItemIcon-root': { color: 'primary.main' },
              },
            })}
          >
            <ListItemIcon sx={{ color: 'text.secondary' }}>
              <Box
                sx={(theme) => ({
                  width: 32,
                  height: 32,
                  borderRadius: 1.5,
                  display: 'grid',
                  placeItems: 'center',
                  color: 'inherit',
                  bgcolor: alpha(ink(theme), 0.05),
                  '& svg': { fontSize: 19 },
                })}
              >
                {item.icon}
              </Box>
            </ListItemIcon>
            <ListItemText
              primary={
                item.label === 'friends' ? (
                  <PendingBadge count={pending}>{messages.nav.friends}</PendingBadge>
                ) : (
                  messages.nav[item.label]
                )
              }
              secondary={messages.nav.communityHints[item.label]}
              slotProps={{
                primary: { sx: { fontWeight: 700 } },
                secondary: { sx: { fontSize: '0.75rem' } },
              }}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
