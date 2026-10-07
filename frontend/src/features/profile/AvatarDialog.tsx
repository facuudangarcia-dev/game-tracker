import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined';
import UploadIcon from '@mui/icons-material/Upload';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import { alpha, useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { type ChangeEvent, useRef, useState } from 'react';
import { messages } from '../../i18n/messages';
import { getApiErrorMessage } from '../../lib/api/errors';
import { ambientBackground, brandGradient } from '../../theme/brand';
import type { User } from '../auth/api';
import { useRemoveAvatar, useSetAvatarPreset, useUploadAvatar } from './api';
import { AvatarIllustration } from './AvatarIllustration';
import { AVATAR_MAX_BYTES, AVATAR_PRESETS, AVATAR_TYPES } from './avatarPresets';
import { PlayerAvatar } from './PlayerAvatar';

const t = messages.profile;

/** Choose the profile picture: upload an image or pick a built-in avatar. */
export function AvatarDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down('sm'));
  const fileInput = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const setPreset = useSetAvatarPreset();
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();
  const pending = setPreset.isPending || upload.isPending || remove.isPending;
  const failed = [setPreset, upload, remove].find((mutation) => mutation.isError);
  const error = localError ?? (failed ? getApiErrorMessage(failed.error, t.serverErrors) : null);
  const current = user.avatar?.kind === 'preset' ? user.avatar.preset : null;

  const done = { onSuccess: onClose };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    if (!AVATAR_TYPES.includes(file.type)) {
      setLocalError(t.avatarDialog.invalidType);
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setLocalError(t.avatarDialog.tooLarge);
      return;
    }
    setLocalError(null);
    upload.mutate(file, done);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="sm"
      aria-labelledby="avatar-dialog-title"
      slotProps={{
        paper: {
          sx: (theme) => ({
            borderRadius: fullScreen ? 0 : 4,
            backgroundImage: 'none',
            bgcolor: 'background.default',
            border: fullScreen ? 'none' : `1px solid ${alpha(theme.palette.common.white, 0.1)}`,
          }),
        },
      }}
    >
      <Box
        sx={(theme) => ({
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: 3,
          py: 2.5,
          background: ambientBackground(theme),
        })}
      >
        <PlayerAvatar avatar={user.avatar} username={user.username} size={64} />
        <Box>
          <Typography id="avatar-dialog-title" variant="h6" component="h2" sx={{ fontWeight: 900 }}>
            {t.avatarDialog.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {user.username}
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

      <Stack spacing={3} sx={{ p: 3 }}>
        <Box>
          <input
            ref={fileInput}
            type="file"
            accept={AVATAR_TYPES.join(',')}
            hidden
            onChange={handleFile}
            data-testid="avatar-file-input"
          />
          <Button
            variant="contained"
            size="large"
            fullWidth
            startIcon={<UploadIcon />}
            loading={upload.isPending}
            disabled={pending}
            onClick={() => fileInput.current?.click()}
            sx={(theme) => ({
              fontWeight: 800,
              color: theme.palette.common.white,
              background: brandGradient(theme, 110),
              '&:hover': { background: brandGradient(theme, 110), filter: 'brightness(1.08)' },
            })}
          >
            {t.avatarDialog.upload}
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {t.avatarDialog.uploadHint}
          </Typography>
        </Box>

        <Box>
          <Typography
            id="avatar-presets"
            variant="overline"
            sx={{
              display: 'block',
              color: 'text.secondary',
              fontWeight: 700,
              letterSpacing: 1.2,
              mb: 1,
            }}
          >
            {t.avatarDialog.presets}
          </Typography>
          <Box
            role="radiogroup"
            aria-labelledby="avatar-presets"
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: { xs: 'repeat(4, 1fr)', sm: 'repeat(6, 1fr)' },
            }}
          >
            {AVATAR_PRESETS.map((preset) => {
              const checked = preset === current;
              return (
                <ButtonBase
                  key={preset}
                  role="radio"
                  aria-checked={checked}
                  aria-label={t.presetNames[preset]}
                  title={t.presetNames[preset]}
                  disabled={pending}
                  onClick={() => setPreset.mutate(preset, done)}
                  sx={(theme) => ({
                    aspectRatio: '1',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    outline: checked
                      ? `3px solid ${theme.palette.primary.main}`
                      : `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
                    outlineOffset: checked ? 2 : 0,
                    boxShadow: checked
                      ? `0 0 22px ${alpha(theme.palette.primary.main, 0.6)}`
                      : 'none',
                    transition: 'transform .15s ease',
                    '&:hover': { transform: 'scale(1.06)' },
                    '&.Mui-focusVisible': { outline: `3px solid ${theme.palette.secondary.main}` },
                  })}
                >
                  <AvatarIllustration preset={preset} />
                </ButtonBase>
              );
            })}
          </Box>
        </Box>

        {error ? (
          <Alert severity="error" variant="outlined">
            {error}
          </Alert>
        ) : null}

        {user.avatar ? (
          <Button
            color="error"
            startIcon={<DeleteOutlineOutlined />}
            loading={remove.isPending}
            disabled={pending}
            onClick={() => remove.mutate(undefined, done)}
            sx={{ alignSelf: 'flex-start' }}
          >
            {t.avatarDialog.remove}
          </Button>
        ) : null}
      </Stack>
    </Dialog>
  );
}
