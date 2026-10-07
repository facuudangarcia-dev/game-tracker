/** Where the auth pages keep the place the user was going to (see RequireAuth). */
export interface AuthLocationState {
  from?: { pathname: string; search?: string };
  /** Set by the verification page: shows a success message and pre-fills the email. */
  verifiedEmail?: string;
  /** Set right after registering: a code was just sent. */
  codeSent?: boolean;
}

export function verifyEmailPath(email: string): string {
  return `/verify-email?${new URLSearchParams({ email }).toString()}`;
}
