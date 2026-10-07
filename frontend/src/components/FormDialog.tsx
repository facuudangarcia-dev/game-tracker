import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { type FormEvent, type ReactNode, useId } from 'react';
import { messages } from '../i18n/messages';
import { type DialogTone, dialogPaperSx, primaryActionSx } from '../theme/brand';
import { DialogFooter, DialogHeader } from './DialogChrome';

interface FormDialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel?: string;
  submitColor?: 'primary' | 'error';
  pending?: boolean;
  /** Server error message, shown above the actions. */
  error?: string | null;
  /** Context shown above the title (e.g. the game's name). */
  eyebrow?: string;
  /** Icon of the dialog's header. */
  icon?: ReactNode;
  children: ReactNode;
}

/**
 * Dialog wrapping a form, in Game Tracker's dialog style (full screen on small
 * devices). `submitColor="error"` turns it into the destructive variant.
 */
export function FormDialog({
  open,
  title,
  onClose,
  onSubmit,
  submitLabel = messages.common.save,
  submitColor = 'primary',
  pending = false,
  error,
  eyebrow,
  icon,
  children,
}: FormDialogProps) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down('sm'));
  const titleId = useId();
  const tone: DialogTone = submitColor === 'error' ? 'danger' : 'default';

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="sm"
      aria-labelledby={titleId}
      slotProps={{ paper: { sx: (theme) => dialogPaperSx(theme, fullScreen, tone) } }}
    >
      <Box
        component="form"
        onSubmit={handleSubmit}
        noValidate
        sx={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: fullScreen ? '100%' : undefined,
        }}
      >
        <DialogHeader
          titleId={titleId}
          title={title}
          eyebrow={eyebrow}
          icon={icon}
          tone={tone}
          onClose={onClose}
        />
        <Stack spacing={2.5} sx={{ px: 3, pt: 3, pb: 3, flex: 1 }}>
          {children}
          {error ? (
            <Alert severity="error" variant="outlined">
              {error}
            </Alert>
          ) : null}
        </Stack>
        <DialogFooter>
          <Button onClick={onClose} color="inherit">
            {messages.common.cancel}
          </Button>
          <Button
            type="submit"
            variant="contained"
            size="large"
            loading={pending}
            sx={(theme) => primaryActionSx(theme, tone)}
          >
            {submitLabel}
          </Button>
        </DialogFooter>
      </Box>
    </Dialog>
  );
}
