import { SetMetadata } from '@nestjs/common';
import { PRIVACY_VERSION, TERMS_VERSION } from './auth.constants';

export const LEGAL_EXEMPT_KEY = 'legalExempt';

/**
 * Route usable before accepting the current legal documents (decision #88):
 * reading the session, accepting them, deleting the account.
 */
export const LegalExempt = () => SetMetadata(LEGAL_EXEMPT_KEY, true);

/** The user accepted older versions of the Terms or the Privacy policy. */
export function needsLegalAcceptance(user: { termsVersion: string; privacyVersion: string }) {
  return user.termsVersion !== TERMS_VERSION || user.privacyVersion !== PRIVACY_VERSION;
}
