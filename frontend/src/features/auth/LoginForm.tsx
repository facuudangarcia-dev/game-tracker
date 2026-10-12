import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { type FormEvent, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router';
import { messages } from '../../i18n/messages';
import { primaryActionSx } from '../../theme/brand';
import { isEmailNotVerified, unverifiedEmail } from './api';
import { AuthCard } from './AuthCard';
import { type AuthLocationState, verifyEmailPath } from './authLocation';
import { getAuthErrorMessage } from './errorMessages';
import { PasswordField } from './PasswordField';
import { useLogin } from './useAuthMutations';
import { type LoginErrors, USERNAME_MAX_LENGTH, validateLogin } from './validation';

const t = messages.auth;

/**
 * Login form, with the username in any case (decision #76). On success the
 * current-user cache is updated and RedirectIfAuthenticated takes the user where
 * they were going. Unverified accounts are sent to the email verification flow.
 */
export function LoginForm() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state as AuthLocationState | null) ?? {};
  const login = useLogin();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = { username: username.trim(), password };
    const validationErrors = validateLogin(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length === 0) {
      login.mutate(values);
    }
  };

  const notVerified = login.isError && isEmailNotVerified(login.error);
  const email = login.isError ? unverifiedEmail(login.error) : null;

  return (
    <AuthCard title={t.login.title} subtitle={t.login.subtitle} onSubmit={handleSubmit}>
      {state.verified && !login.isError ? (
        <Alert severity="success" variant="outlined">
          {t.verified}
        </Alert>
      ) : null}

      {notVerified ? (
        <Alert
          severity="warning"
          variant="outlined"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() =>
                void navigate(email ? verifyEmailPath(email) : '/verify-email', {
                  state: { from: state.from } satisfies AuthLocationState,
                })
              }
            >
              {t.notVerified.action}
            </Button>
          }
        >
          {t.notVerified.body}
        </Alert>
      ) : login.isError ? (
        <Alert severity="error" variant="outlined">
          {getAuthErrorMessage(login.error)}
        </Alert>
      ) : null}

      <TextField
        label={t.username}
        autoComplete="username"
        autoFocus
        required
        fullWidth
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        error={Boolean(errors.username)}
        helperText={errors.username}
        slotProps={{ htmlInput: { maxLength: USERNAME_MAX_LENGTH, autoCapitalize: 'none' } }}
      />
      <PasswordField
        label={t.password}
        autoComplete="current-password"
        required
        fullWidth
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={Boolean(errors.password)}
        helperText={errors.password}
      />

      <Button
        type="submit"
        variant="contained"
        size="large"
        loading={login.isPending}
        sx={(theme) => primaryActionSx(theme)}
      >
        {t.login.submit}
      </Button>

      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
        {t.login.noAccount}{' '}
        <Link
          component={RouterLink}
          to="/register"
          state={{ from: state.from } satisfies AuthLocationState}
        >
          {t.login.goToRegister}
        </Link>
      </Typography>
    </AuthCard>
  );
}
