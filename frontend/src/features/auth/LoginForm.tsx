import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { type FormEvent, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router';
import { messages } from '../../i18n/messages';
import { isEmailNotVerified } from './api';
import { AuthCard } from './AuthCard';
import { type AuthLocationState, verifyEmailPath } from './authLocation';
import { getAuthErrorMessage } from './errorMessages';
import { PasswordField } from './PasswordField';
import { useLogin } from './useAuthMutations';
import { type CredentialErrors, validateCredentials } from './validation';

const t = messages.auth;

/**
 * Login form. On success the current-user cache is updated and
 * RedirectIfAuthenticated takes the user where they were going. Unverified
 * accounts are sent to the email verification flow.
 */
export function LoginForm() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state as AuthLocationState | null) ?? {};
  const login = useLogin();

  const [email, setEmail] = useState(state.verifiedEmail ?? '');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<CredentialErrors>({});

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = { email: email.trim(), password };
    const validationErrors = validateCredentials(values, 'login');
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length === 0) {
      login.mutate(values);
    }
  };

  const notVerified = login.isError && isEmailNotVerified(login.error);

  return (
    <AuthCard title={t.login.title} onSubmit={handleSubmit}>
      {state.verifiedEmail && !login.isError ? (
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
                void navigate(verifyEmailPath(email.trim()), {
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
        label={t.email}
        type="email"
        autoComplete="email"
        autoFocus={!state.verifiedEmail}
        required
        fullWidth
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={Boolean(errors.email)}
        helperText={errors.email}
      />
      <PasswordField
        label={t.password}
        autoComplete="current-password"
        autoFocus={Boolean(state.verifiedEmail)}
        required
        fullWidth
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={Boolean(errors.password)}
        helperText={errors.password}
      />

      <Button type="submit" variant="contained" size="large" loading={login.isPending}>
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
