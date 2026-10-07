import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { messages } from '../i18n/messages';
import { ambientBackground, type DialogTone, toneColor } from '../theme/brand';

interface DialogHeaderProps {
  /** Id of the title, for the dialog's aria-labelledby. */
  titleId: string;
  title: string;
  /** Context above the title (e.g. the game the dialog is about). */
  eyebrow?: string;
  icon?: ReactNode;
  tone?: DialogTone;
  onClose: () => void;
}

/** Header shared by every dialog: ambient band, icon badge, context, title and close. */
export function DialogHeader({
  titleId,
  title,
  eyebrow,
  icon,
  tone = 'default',
  onClose,
}: DialogHeaderProps) {
  return (
    <Box
      sx={(theme) => {
        const color = toneColor(theme, tone);
        return {
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 1.75,
          pl: 3,
          pr: 7,
          py: 2.5,
          background:
            tone === 'danger'
              ? `radial-gradient(circle at 0% 0%, ${alpha(color, 0.22)}, transparent 55%), ${theme.palette.background.paper}`
              : ambientBackground(theme),
          borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
        };
      }}
    >
      {icon ? (
        <Box
          aria-hidden
          sx={(theme) => {
            const color = toneColor(theme, tone);
            return {
              width: 44,
              height: 44,
              flexShrink: 0,
              borderRadius: 2.25,
              display: 'grid',
              placeItems: 'center',
              color,
              bgcolor: alpha(color, 0.16),
              border: `1px solid ${alpha(color, 0.35)}`,
              boxShadow: `0 0 22px -6px ${alpha(color, 0.9)}`,
              '& svg': { fontSize: 22 },
            };
          }}
        >
          {icon}
        </Box>
      ) : null}
      <Box sx={{ minWidth: 0 }}>
        {eyebrow ? (
          <Typography
            variant="overline"
            sx={{
              display: 'block',
              color: tone === 'danger' ? 'error.light' : 'primary.main',
              fontWeight: 800,
              letterSpacing: 1.6,
              lineHeight: 1.6,
            }}
            noWrap
          >
            {eyebrow}
          </Typography>
        ) : null}
        <Typography
          id={titleId}
          variant="h6"
          component="h2"
          sx={{ fontWeight: 900, lineHeight: 1.2, letterSpacing: -0.3, overflowWrap: 'anywhere' }}
        >
          {title}
        </Typography>
      </Box>
      <IconButton
        aria-label={messages.common.close}
        onClick={onClose}
        sx={{ position: 'absolute', top: 10, right: 10 }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

/** Footer of a dialog: secondary action(s) on the left of the main one, on a paper band. */
export function DialogFooter({ children }: { children: ReactNode }) {
  return (
    <Stack
      direction={{ xs: 'column-reverse', sm: 'row' }}
      spacing={1.5}
      sx={(theme) => ({
        px: 3,
        py: 2,
        justifyContent: 'flex-end',
        borderTop: `1px solid ${theme.palette.divider}`,
        bgcolor: 'background.paper',
      })}
    >
      {children}
    </Stack>
  );
}
