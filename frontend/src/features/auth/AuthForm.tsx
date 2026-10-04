import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { type FormEvent, useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router';
import { messages } from '../../i18n/messages';
import { getAuthErrorMessage } from './errorMessages';
import { PasswordField } from './PasswordField';
import { useLogin, useRegister } from './useAuthMutations';
import {
  type AuthMode,
  type CredentialErrors,
  PASSWORD_MIN_LENGTH,
  validateCredentials,
} from './validation';

const t = messages.auth;

/**
 * Shared login/register form. On success the current-user cache is updated and
 * RedirectIfAuthenticated takes the user where they were going.
 */
export function AuthForm({ mode }: { mode: AuthMode }) {
  const location = useLocation();
  const login = useLogin();
  const register = useRegister();
  const mutation = mode === 'login' ? login : register;
  const copy = mode === 'login' ? t.login : t.register;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<CredentialErrors>({});

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = { email: email.trim(), password };
    const validationErrors = validateCredentials(values, mode);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length === 0) {
      mutation.mutate(values);
    }
  };

  return (
    <Paper
      variant="outlined"
      sx={{ maxWidth: 420, mx: 'auto', mt: { xs: 2, md: 6 }, p: { xs: 3, sm: 4 } }}
    >
      <Stack component="form" spacing={2.5} noValidate onSubmit={handleSubmit}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          {copy.title}
        </Typography>

        {mutation.isError ? (
          <Alert severity="error" variant="outlined">
            {getAuthErrorMessage(mutation.error)}
          </Alert>
        ) : null}

        <TextField
          label={t.email}
          type="email"
          autoComplete="email"
          autoFocus
          required
          fullWidth
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={Boolean(errors.email)}
          helperText={errors.email}
        />
        <PasswordField
          label={t.password}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          required
          fullWidth
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={Boolean(errors.password)}
          helperText={
            errors.password ??
            (mode === 'register' ? t.validation.passwordHint(PASSWORD_MIN_LENGTH) : undefined)
          }
        />

        <Button type="submit" variant="contained" size="large" loading={mutation.isPending}>
          {copy.submit}
        </Button>

        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
          {mode === 'login' ? t.login.noAccount : t.register.hasAccount}{' '}
          <Link
            component={RouterLink}
            to={mode === 'login' ? '/register' : '/login'}
            state={location.state as unknown}
          >
            {mode === 'login' ? t.login.goToRegister : t.register.goToLogin}
          </Link>
        </Typography>
      </Stack>
    </Paper>
  );
}
