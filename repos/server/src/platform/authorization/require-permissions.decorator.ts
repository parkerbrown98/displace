import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSIONS = Symbol('REQUIRED_PERMISSIONS');

export const RequirePermissions = (
  ...permissions: string[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);
