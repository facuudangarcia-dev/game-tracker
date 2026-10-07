import { type EmailMessage, EmailService } from '../src/email/email.service';

/** In-memory EmailService for tests: records messages instead of calling Resend. */
export class MockEmailService extends EmailService {
  readonly sent: EmailMessage[] = [];
  /** When set, the next sends fail with this error. */
  failWith: Error | null = null;

  send(message: EmailMessage): Promise<void> {
    if (this.failWith) {
      return Promise.reject(this.failWith);
    }
    this.sent.push(message);
    return Promise.resolve();
  }

  /** Verification code of the last email sent to `to`. */
  lastCode(to: string): string {
    const message = [...this.sent].reverse().find((m) => m.to === to);
    const code = message?.text.match(/\b(\d{6})\b/)?.[1];
    if (!code) {
      throw new Error(`No verification code was sent to ${to}`);
    }
    return code;
  }

  reset(): void {
    this.sent.length = 0;
    this.failWith = null;
  }
}
