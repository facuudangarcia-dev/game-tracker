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
}

/** Circular avatar: uploaded image, built-in illustration or the username's initial. */
export function PlayerAvatar({ avatar, username, size }: PlayerAvatarProps) {
  const label = messages.profile.avatarAlt(username);
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
          alt={label}
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : avatar?.kind === 'preset' && isAvatarPreset(avatar.preset) ? (
        <Box role="img" aria-label={label} sx={{ width: '100%', height: '100%' }}>
          <AvatarIllustration preset={avatar.preset} />
        </Box>
      ) : (
        <Box
          role="img"
          aria-label={label}
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
