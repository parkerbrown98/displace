export interface UserProfile {
  id: string;
  handle: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
}

export interface Authentication {
  accessToken: string;
  csrfToken?: string;
  expiresInSeconds: number;
  user: UserProfile;
}

export interface AccountSession {
  id: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  current: boolean;
}

export interface RegisterInput {
  displayName: string;
  email: string;
  handle: string;
  password: string;
}

export interface SignInInput {
  identifier: string;
  password: string;
}

export interface MessageResponse {
  message: string;
}