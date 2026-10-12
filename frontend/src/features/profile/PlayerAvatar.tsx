import Box from '@mui/material/Box';
import type { Avatar } from '../auth/api';
import { brandGradient } from '../../theme/brand';
import { messages } from '../../i18n/messages';
import { AvatarIllustration } from './AvatarIllustration';
import { isAvatarPreset } from './avatarPresets';

interface PlayerAvatarProps {
  avatar: Avatar;
  username: string;
  size: number;
  /** Inside a labelled control or next to the username: hidden from assistive tech. */
  decorative?: boolean;
}

/** Circular avatar: uploaded image, built-in illustration or the username's initial. */
export function PlayerAvatar({ avatar, username, size, decorative = false }: PlayerAvatarProps) {
  const label = messages.profile.avatarAlt(username);
  const a11y = decorative
    ? ({ 'aria-hidden': true } as const)
    : ({ role: 'img', 'aria-label': label } as const);
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      {avatar?.kind === 'custom' ? (
        <Box
          component="img"
          src={avatar.url}
          alt={decorative ? '' : label}
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : avatar?.kind === 'preset' && isAvatarPreset(avatar.preset) ? (
        <Box {...a11y} sx={{ width: '100%', height: '100%' }}>
          <AvatarIllustration preset={avatar.preset} />
        </Box>
      ) : (
        <Box
          {...a11y}
          sx={(theme) => ({
            width: '100%',
            height: '100%',
            display: 'grid',
            placeItems: 'center',
            background: brandGradient(theme, 135),
            color: theme.palette.common.white,
            fontWeight: 900,
            fontSize: size * 0.42,
            textTransform: 'uppercase',
          })}
        >
          {username.charAt(0)}
        </Box>
      )}
    </Box>
  );
}
