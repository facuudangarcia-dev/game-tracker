import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { messages } from '../i18n/messages';
import { FormDialog } from './FormDialog';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  pending?: boolean;
  error?: string | null;
  /** Context shown above the title (e.g. the game's name). */
  eyebrow?: string;
  onConfirm: () => void;
  onClose: () => void;
}

/** Confirmation required before every destructive action (danger variant of the dialog). */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = messages.common.delete,
  pending,
  error,
  eyebrow,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <FormDialog
      open={open}
      title={title}
      eyebrow={eyebrow}
      icon={<WarningAmberRoundedIcon />}
      onClose={onClose}
      onSubmit={onConfirm}
      submitLabel={confirmLabel}
      submitColor="error"
      pending={pending}
      error={error}
    >
      <Typography
        sx={(theme) => ({
          p: 2,
          borderRadius: 2,
          lineHeight: 1.6,
          bgcolor: alpha(theme.palette.error.main, 0.07),
          border: `1px solid ${alpha(theme.palette.error.main, 0.25)}`,
        })}
      >
        {body}
      </Typography>
    </FormDialog>
  );
}
