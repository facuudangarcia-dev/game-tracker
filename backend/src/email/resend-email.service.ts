import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation';
import { EmailDeliveryError, type EmailMessage, EmailService } from './email.service';

const RESEND_API_URL = 'https://api.resend.com/emails';
const REQUEST_TIMEOUT_MS = 10_000;

/** Sends emails through the Resend HTTP API. The API key never leaves this class. */
@Injectable()
export class ResendEmailService extends EmailService {
  private readonly logger = new Logger(ResendEmailService.name);
  private readonly apiKey: string | undefined;
  private readonly from: string | undefined;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super();
    this.apiKey = config.get('RESEND_API_KEY', { infer: true });
    this.from = config.get('EMAIL_FROM', { infer: true });
  }

  async send(message: EmailMessage): Promise<void> {
    if (!this.apiKey || !this.from) {
      throw new EmailDeliveryError('Email delivery is not configured');
    }

    let response: Response;
    try {
      response = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      // Only the error type is logged: never the request (it carries the API key).
      this.logger.error(`Resend request failed (${(error as Error).name})`);
      throw new EmailDeliveryError();
    }

    if (!response.ok) {
      this.logger.error(`Resend rejected the email with status ${response.status}`);
      throw new EmailDeliveryError();
    }
  }
}
