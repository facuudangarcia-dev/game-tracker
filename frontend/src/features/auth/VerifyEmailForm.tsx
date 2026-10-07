import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { type FormEvent, useEffect, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate, useSearchParams } from 'react-router';
import { messages } from '../../i18n/messages';
import { AuthCard } from './AuthCard';
import { type AuthLocationState } from './authLocation';
import { getAuthErrorMessage } from './errorMessages';
import { useResendVerification, useVerifyEmail } from './useAuthMutations';
import {
  RESEND_COOLDOWN_SECONDS,
  VERIFICATION_CODE_LENGTH,
  validateEmail,
  validateVerificationCode,
} from './validation';

const t = messages.auth.verify;

/** Seconds left of a countdown that can be restarted. */
function useCountdown(initialSeconds: number) {
  const [seconds, setSeconds] = useState(initialSeconds);
  useEffect(() => {
    if (seconds <= 0) {
      return;
    }
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  return [seconds, setSeconds] as const;
}

/**
 * "Verify your email" screen: 6-digit code + resend with cooldown. On success it
 * goes back to the login (verifying never opens a session).
 */
export function VerifyEmailForm() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const state = (location.state as AuthLocationState | null) ?? {};
  const knownEmail = searchParams.get('email')?.trim() ?? '';

  const verify = useVerifyEmail();
  const resend = useResendVerification();
  const [email, setEmail] = useState(knownEmail);
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<{ email?: string; code?: string }>({});
  const [cooldown, setCooldown] = useCountdown(state.codeSent ? RESEND_COOLDOWN_SECONDS : 0);

  const emailError = () => validateEmail(email);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationErrors = { email: emailError(), code: validateVerificationCode(code) };
    setErrors(validationErrors);
    if (validationErrors.email || validationErrors.code) {
      return;
    }
    resend.reset();
    verify.mutate(
      { email: email.trim(), code: code.trim() },
      {
        onSuccess: () =>
          void navigate('/login', {
            replace: true,
            state: { from: state.from, verifiedEmail: email.trim() } satisfies AuthLocationState,
          }),
      },
    );
  };

  const handleResend = () => {
    const error = emailError();
    setErrors({ email: error });
    if (error) {
      return;
    }
    verify.reset();
    setCooldown(RESEND_COOLDOWN_SECONDS);
    resend.mutate(email.trim());
  };

  return (
    <AuthCard title={t.title} onSubmit={handleSubmit}>
      {knownEmail ? (
        <div>
          <Typography color="text.secondary">{state.codeSent ? t.sentTo : t.enterCode}</Typography>
          <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere', mt: 0.5 }}>
            {knownEmail}
          </Typography>
        </div>
      ) : (
        <>
          <Typography color="text.secondary">{t.enterCode}</Typography>
          <TextField
            label={t.emailLabel}
            type="email"
            autoComplete="email"
            required
            fullWidth
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={Boolean(errors.email)}
            helperText={errors.email}
          />
        </>
      )}

      {verify.isError ? (
        <Alert severity="error" variant="outlined">
          {getAuthErrorMessage(verify.error)}
        </Alert>
      ) : null}
      {resend.isSuccess ? (
        <Alert severity="info" variant="outlined">
          {t.resent}
        </Alert>
      ) : resend.isError ? (
        <Alert severity="error" variant="outlined">
          {getAuthErrorMessage(resend.error)}
        </Alert>
      ) : null}

      <TextField
        label={t.code}
        autoFocus
        required
        fullWidth
        value={code}
        // Digits only: pasting "123 456" or "123-456" still works.
        onChange={(e) =>
          setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, VERIFICATION_CODE_LENGTH))
        }
        error={Boolean(errors.code)}
        helperText={errors.code ?? t.expiresHint}
        placeholder="______"
        slotProps={{
          htmlInput: {
            inputMode: 'numeric',
            autoComplete: 'one-time-code',
            maxLength: VERIFICATION_CODE_LENGTH,
            style: {
              textAlign: 'center',
              fontSize: '1.75rem',
              letterSpacing: '0.5em',
              fontVariantNumeric: 'tabular-nums',
            },
          },
        }}
      />

      <Button type="submit" variant="contained" size="large" loading={verify.isPending}>
        {t.submit}
      </Button>
      <Button
        variant="text"
        onClick={handleResend}
        disabled={cooldown > 0}
        loading={resend.isPending}
      >
        {cooldown > 0 ? t.resendIn(cooldown) : t.resend}
      </Button>

      <Typography variant="body2" sx={{ textAlign: 'center' }}>
        <Link
          component={RouterLink}
          to="/login"
          state={{ from: state.from } satisfies AuthLocationState}
        >
          {t.backToLogin}
        </Link>
      </Typography>
    </AuthCard>
  );
}
