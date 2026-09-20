export const AUTH_MAIL_QUEUE = 'mail';

export type AuthMailJob =
  | { kind: 'registration-attempt' }
  | { kind: 'password-reset-attempt' }
  | {
      kind: 'verify-email';
      recipient: string;
      token: string;
    }
  | {
      kind: 'reset-password';
      recipient: string;
      token: string;
    };
