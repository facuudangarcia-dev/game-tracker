import Check from '@mui/icons-material/Check';
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlined from '@mui/icons-material/LightModeOutlined';
import SettingsBrightnessOutlined from '@mui/icons-material/SettingsBrightnessOutlined';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { alpha, useTheme } from '@mui/material/styles';
import { useState } from 'react';
import { messages } from '../../i18n/messages';
import { ink } from '../../theme/brand';
import {
  COLOR_MODE_PREFERENCES,
  type ColorModePreference,
  setColorModePreference,
  useColorModePreference,
} from '../../theme/colorMode';

const ICONS: Record<ColorModePreference, typeof LightModeOutlined> = {
  system: SettingsBrightnessOutlined,
  light: LightModeOutlined,
  dark: DarkModeOutlined,
};

/** Header control (decision #83): light, dark or the device's setting. */
export function ThemeSelector() {
  const t = messages.colorMode;
  const preference = useColorModePreference();
  const theme = useTheme();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  // The button shows the mode in use (sun or moon).
  const Current = theme.palette.mode === 'dark' ? DarkModeOutlined : LightModeOutlined;

  return (
    <>
      <IconButton
        aria-label={t.button(t.options[preference])}
        aria-haspopup="menu"
        aria-expanded={anchor ? 'true' : undefined}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{
          p: 0.9,
          borderRadius: 99,
          border: `1px solid ${alpha(ink(theme), 0.1)}`,
          bgcolor: alpha(ink(theme), 0.03),
          '&:hover': {
            borderColor: alpha(theme.palette.primary.main, 0.5),
            bgcolor: alpha(theme.palette.primary.main, 0.08),
          },
        }}
      >
        <Current fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {COLOR_MODE_PREFERENCES.map((option) => {
          const Icon = ICONS[option];
          return (
            <MenuItem
              key={option}
              selected={option === preference}
              onClick={() => {
                setAnchor(null);
                setColorModePreference(option);
              }}
            >
              <ListItemIcon>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{t.options[option]}</ListItemText>
              {option === preference ? (
                <Check fontSize="small" sx={{ ml: 2, color: 'primary.main' }} aria-hidden />
              ) : null}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
