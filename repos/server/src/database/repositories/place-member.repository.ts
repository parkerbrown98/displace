import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, lt, or } from 'drizzle-orm';
import { DATABASE } from '../database.constants.js';
import type { Database } from '../database.types.js';
import { placeMembers } from '../schema/index.js';
import type { PlaceScope } from './place-scope.js';

export interface PlaceMemberCursor {
  createdAt: Date;
  id: string;
}

@Injectable()
export class PlaceMemberRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  findActiveByUser(scope: PlaceScope, userId: string) {
    return this.database.query.placeMembers.findFirst({
      where: and(
        eq(placeMembers.placeId, scope.placeId),
        eq(placeMembers.userId, userId),
        eq(placeMembers.status, 'active'),
      ),
    });
  }

  listActive(
    scope: PlaceScope,
    options: { cursor?: PlaceMemberCursor; limit: number },
  ) {
    const cursorCondition = options.cursor
      ? or(
          lt(placeMembers.createdAt, options.cursor.createdAt),
          and(
            eq(placeMembers.createdAt, options.cursor.createdAt),
            lt(placeMembers.id, options.cursor.id),
          ),
        )
      : undefined;

    return this.database.query.placeMembers.findMany({
      limit: Math.min(Math.max(options.limit, 1), 100),
      orderBy: [desc(placeMembers.createdAt), desc(placeMembers.id)],
      where: and(
        eq(placeMembers.placeId, scope.placeId),
        eq(placeMembers.status, 'active'),
        cursorCondition,
      ),
    });
  }
}
