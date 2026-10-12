import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { alpha, type Theme } from '@mui/material/styles';
import { useState } from 'react';
import { NavLink } from 'react-router';
import { messages } from '../../i18n/messages';
import { exploreItems, useIsExploreActive } from './exploreItems';
import { ink } from '../../theme/brand';

/**
 * "Explorar" in the header: one button opening the sections, so the header
 * doesn't grow with each of them.
 */
export function ExploreMenuButton({
  loggedIn,
  buttonSx,
}: {
  loggedIn: boolean;
  buttonSx: (theme: Theme) => object;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const active = useIsExploreActive();
  const items = exploreItems(loggedIn);

  return (
    <>
      <Button
        color="inherit"
        id="explore-menu-button"
        aria-haspopup="menu"
        aria-controls={anchor ? 'explore-menu' : undefined}
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
        {messages.nav.explore}
      </Button>
      <Menu
        id="explore-menu"
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{
          list: { 'aria-labelledby': 'explore-menu-button' },
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
        {items.map((item) => [
          item.personal ? <Divider key={`${item.to}-divider`} /> : null,
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
              primary={messages.nav[item.label]}
              secondary={messages.nav.exploreHints[item.label]}
              slotProps={{
                primary: { sx: { fontWeight: 700 } },
                secondary: { sx: { fontSize: '0.75rem' } },
              }}
            />
          </MenuItem>,
        ])}
      </Menu>
    </>
  );
}
