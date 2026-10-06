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
  onConfirm: () => void;
  onClose: () => void;
}

/** Confirmation required before every destructive action. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = messages.common.delete,
  pending,
  error,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <FormDialog
      open={open}
      title={title}
      onClose={onClose}
      onSubmit={onConfirm}
      submitLabel={confirmLabel}
      submitColor="error"
      pending={pending}
      error={error}
    >
      <Typography>{body}</Typography>
    </FormDialog>
  );
}
