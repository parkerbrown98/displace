export interface AuthenticatedUser {
  id: string;
  sessionId?: string;
}

export interface AuthorizedPlace {
  id: string;
  slug: string;
}

export interface AuthorizationContext {
  user: AuthenticatedUser;
  place?: AuthorizedPlace;
  permissions: ReadonlySet<string>;
}
