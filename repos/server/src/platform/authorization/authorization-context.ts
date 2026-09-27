export interface AuthenticatedUser {
  apiTokenId?: string;
  apiTokenScopes?: ReadonlySet<string>;
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
