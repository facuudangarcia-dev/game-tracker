export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Thrown when an email could not be delivered to the provider. */
export class EmailDeliveryError extends Error {
  constructor(message = 'Email delivery failed') {
    super(message);
    this.name = 'EmailDeliveryError';
  }
}

/**
 * Outgoing email abstraction (also the DI token). The app depends only on this
 * class; Resend is one implementation and tests use an in-memory mock.
 */
export abstract class EmailService {
  abstract send(message: EmailMessage): Promise<void>;
}
