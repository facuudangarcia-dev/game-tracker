import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { FormDialog } from '../../components/FormDialog';
import { messages } from '../../i18n/messages';
import { getApiErrorMessage } from '../../lib/api/errors';
import { PasswordField } from '../auth/PasswordField';
import { useDeleteAccount } from '../auth/useAuthMutations';

const t = messages.profile.deleteAccount;

/** Deletes the account and all its data (decision #82), after confirming the password. */
export function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const remove = useDeleteAccount();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const passwordError = password ? undefined : messages.auth.validation.passwordRequired;

  return (
    <FormDialog
      open
      title={t.title}
      icon={<WarningAmberRoundedIcon />}
      submitLabel={t.confirm}
      submitColor="error"
      pending={remove.isPending}
      error={remove.isError ? getApiErrorMessage(remove.error, t.errors) : null}
      onClose={onClose}
      onSubmit={() => {
        setShowErrors(true);
        if (passwordError) {
          return;
        }
        remove.mutate(password, {
          onSuccess: () => {
            void navigate('/', { replace: true });
          },
        });
      }}
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
        {t.body}
      </Typography>
      <PasswordField
        label={t.password}
        autoComplete="current-password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={showErrors && Boolean(passwordError)}
        helperText={showErrors ? passwordError : undefined}
      />
    </FormDialog>
  );
}
