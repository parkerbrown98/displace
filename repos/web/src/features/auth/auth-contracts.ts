import type { components } from '@displace/api-client';

export type UserProfile = components['schemas']['UserProfileDto'];
export type Authentication = components['schemas']['AuthenticationDto'];
export type AccountSession = components['schemas']['SessionDto'];
export type RegisterInput = components['schemas']['RegisterDto'];
export type SignInInput = Pick<components['schemas']['LoginDto'], 'identifier' | 'password'>;
export type MessageResponse = components['schemas']['MessageDto'];