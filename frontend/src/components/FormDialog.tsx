import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { FormEvent, ReactNode } from 'react';
import { messages } from '../i18n/messages';

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
  children: ReactNode;
}

/** Dialog wrapping a form; full screen on small devices. */
export function FormDialog({
  open,
  title,
  onClose,
  onSubmit,
  submitLabel = messages.common.save,
  submitColor = 'primary',
  pending = false,
  error,
  children,
}: FormDialogProps) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down('sm'));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {children}
            {error ? (
              <Alert severity="error" variant="outlined">
                {error}
              </Alert>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>{messages.common.cancel}</Button>
          <Button type="submit" variant="contained" color={submitColor} loading={pending}>
            {submitLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
