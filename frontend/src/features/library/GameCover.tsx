import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import Box from '@mui/material/Box';
import { useState } from 'react';
import { messages } from '../../i18n/messages';

interface GameCoverProps {
  src: string | null;
  /** Game name, used as alt text. */
  name: string;
  /** Fixed or responsive width, e.g. { xs: 160, md: 200 }. */
  width?: number | string | Partial<Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', number | string>>;
  /** No rounded corners (e.g. flush at the top of a card). */
  square?: boolean;
}

/** Game cover in 3:4 portrait ratio, with a placeholder when missing or broken. */
export function GameCover({ src, name, width = '100%', square = false }: GameCoverProps) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;

  return (
    <Box
      sx={{
        width,
        aspectRatio: '3 / 4',
        borderRadius: square ? 0 : 1,
        overflow: 'hidden',
        bgcolor: 'action.hover',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {showImage ? (
        <Box
          component="img"
          src={src}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <SportsEsportsIcon
          role="img"
          aria-label={`${name} — ${messages.library.noCover}`}
          sx={{ color: 'text.disabled', fontSize: 'clamp(1.25rem, 30%, 3rem)' }}
        />
      )}
    </Box>
  );
}
