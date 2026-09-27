import { SetMetadata } from '@nestjs/common';
import type { ApiTokenScope } from '../developer-api/developer-api.dto.js';

export const REQUIRED_API_TOKEN_SCOPES = Symbol('required-api-token-scopes');

export const RequireApiTokenScopes = (...scopes: ApiTokenScope[]) =>
  SetMetadata(REQUIRED_API_TOKEN_SCOPES, scopes);