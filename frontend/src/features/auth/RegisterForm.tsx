import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { type FormEvent, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router';
import { useLocale } from '../../i18n/locale';
import { messages } from '../../i18n/messages';
import { primaryActionSx } from '../../theme/brand';
import { countryOptions } from '../explore/countries';
import { usePriceCountry } from '../explore/priceCountry';
import { AuthCard } from './AuthCard';
import { type AuthLocationState, verifyEmailPath } from './authLocation';
import { getAuthErrorMessage } from './errorMessages';
import { PasswordField } from './PasswordField';
import { useRegister } from './useAuthMutations';
import {
  PASSWORD_MIN_LENGTH,
  type RegistrationErrors,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  validateRegistration,
} from './validation';

const t = messages.auth;

/** Legal documents open in a new tab so the half-filled form isn't lost. */
function LegalLink({ to, children }: { to: string; children: string }) {
  return (
    <Link component={RouterLink} to={to} target="_blank" rel="noopener">
      {children}
    </Link>
  );
}

/**
 * Sign-up form. Creates an unverified account (no session) and continues to
 * the "verify your email" screen.
 */
export function RegisterForm() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state as AuthLocationState | null) ?? {};
  const register = useRegister();
  // Re-renders when the language changes: country names are in that language.
  useLocale();
  // The country chosen in this browser or the browser's region; none when unknown
  // (the app is global: nothing is assumed, decision #75).
  const detectedCountry = usePriceCountry();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState(detectedCountry ?? '');
  const [acceptLegal, setAcceptLegal] = useState(false);
  const [errors, setErrors] = useState<RegistrationErrors>({});

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = {
      username: username.trim(),
      email: email.trim(),
      password,
      country,
      acceptLegal,
    };
    const validationErrors = validateRegistration(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }
    register.mutate(
      {
        username: values.username,
        email: values.email,
        password,
        acceptTerms: true,
        acceptPrivacy: true,
        country,
      },
      {
        onSuccess: (user) =>
          void navigate(verifyEmailPath(user.email), {
            state: { from: state.from, codeSent: true } satisfies AuthLocationState,
          }),
      },
    );
  };

  return (
    <AuthCard title={t.register.title} subtitle={t.register.subtitle} onSubmit={handleSubmit}>
      {register.isError ? (
        <Alert severity="error" variant="outlined">
          {getAuthErrorMessage(register.error)}
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
        helperText={
          errors.username ?? t.validation.usernameHint(USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH)
        }
        slotProps={{ htmlInput: { maxLength: USERNAME_MAX_LENGTH } }}
      />
      <TextField
        label={t.email}
        type="email"
        autoComplete="email"
        required
        fullWidth
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={Boolean(errors.email)}
        helperText={errors.email}
      />
      <PasswordField
        label={t.password}
        autoComplete="new-password"
        required
        fullWidth
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={Boolean(errors.password)}
        helperText={errors.password ?? t.validation.passwordHint(PASSWORD_MIN_LENGTH)}
      />
      <TextField
        select
        label={t.country}
        required
        fullWidth
        autoComplete="country"
        value={country}
        onChange={(e) => setCountry(e.target.value)}
        error={Boolean(errors.country)}
        helperText={errors.country ?? t.countryHint}
        slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
      >
        <option value="" disabled>
          {t.chooseCountry}
        </option>
        {countryOptions().map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </TextField>

      <FormControl error={Boolean(errors.acceptLegal)}>
        <FormControlLabel
          sx={{ alignItems: 'flex-start' }}
          control={
            <Checkbox
              checked={acceptLegal}
              onChange={(e) => setAcceptLegal(e.target.checked)}
              sx={{ mt: -1 }}
            />
          }
          label={
            <Typography variant="body2">
              {t.register.acceptPrefix}
              <LegalLink to="/terms">{t.register.terms}</LegalLink>
              {t.register.acceptMiddle}
              <LegalLink to="/privacy">{t.register.privacy}</LegalLink>
              {t.register.acceptSuffix}
            </Typography>
          }
        />
        {errors.acceptLegal ? <FormHelperText>{errors.acceptLegal}</FormHelperText> : null}
      </FormControl>

      <Button
        type="submit"
        variant="contained"
        size="large"
        loading={register.isPending}
        sx={(theme) => primaryActionSx(theme)}
      >
        {t.register.submit}
      </Button>

      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
        {t.register.hasAccount}{' '}
        <Link
          component={RouterLink}
          to="/login"
          state={{ from: state.from } satisfies AuthLocationState}
        >
          {t.register.goToLogin}
        </Link>
      </Typography>
    </AuthCard>
  );
}
