import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { users } from '../database/schema/index.js';
import type { AuthorizedRequest } from '../platform/authorization/authorized-request.js';

@Injectable()
export class InstanceAdminGuard implements CanActivate {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthorizedRequest>();
    if (!request.authorization?.user) {
      throw new UnauthorizedException('Authentication is required.');
    }
    const [user] = await this.database
      .select({ isInstanceAdmin: users.isInstanceAdmin, status: users.status })
      .from(users)
      .where(eq(users.id, request.authorization.user.id))
      .limit(1);
    if (!user?.isInstanceAdmin || user.status !== 'active') {
      throw new ForbiddenException('Instance administrator access is required.');
    }
    return true;
  }
}