import { VERIFICATION_CODE_TTL_MS } from '../auth/auth.constants';
import type { EmailMessage } from './email.service';

const TTL_MINUTES = VERIFICATION_CODE_TTL_MS / 60_000;

/** Email with the 6-digit verification code (Spanish only, like the rest of V1). */
export function verificationEmail(to: string, username: string, code: string): EmailMessage {
  return {
    to,
    subject: `${code} es tu código de verificación de Game Tracker`,
    text: [
      `Hola, ${username}:`,
      '',
      `Tu código para verificar tu email en Game Tracker es: ${code}`,
      '',
      `Vence en ${TTL_MINUTES} minutos. Si no creaste una cuenta, ignorá este mensaje.`,
    ].join('\n'),
    html: `<p>Hola, ${username}:</p>
<p>Tu código para verificar tu email en Game Tracker es:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>
<p>Vence en ${TTL_MINUTES} minutos. Si no creaste una cuenta, ignorá este mensaje.</p>`,
  };
}
