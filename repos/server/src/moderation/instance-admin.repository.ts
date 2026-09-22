import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import {
  auditLog,
  instanceSettings,
  moderationActions,
  notifications,
  sessions,
  users,
} from '../database/schema/index.js';
import type { UpdateInstanceSettingsDto } from './moderation.dto.js';

@Injectable()
export class InstanceAdminRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async getSettings() {
    return this.database.transaction(async (transaction) => {
      await transaction
        .insert(instanceSettings)
        .values({ id: 1 })
        .onConflictDoNothing();
      const [settings] = await transaction
        .select()
        .from(instanceSettings)
        .where(eq(instanceSettings.id, 1))
        .limit(1);
      return settings;
    });
  }

  async updateSettings(
    actorUserId: string,
    input: UpdateInstanceSettingsDto,
    now: Date,
  ) {
    return this.database.transaction(async (transaction) => {
      await transaction
        .insert(instanceSettings)
        .values({ id: 1 })
        .onConflictDoNothing();
      const [current] = await transaction
        .select()
        .from(instanceSettings)
        .where(eq(instanceSettings.id, 1))
        .limit(1)
        .for('update');
      if (!current) throw new NotFoundException('Instance settings were not initialized.');
      const [updated] = await transaction
        .update(instanceSettings)
        .set({
          registrationMode: input.registrationMode ?? current.registrationMode,
          settings: input.settings
            ? { ...current.settings, ...input.settings }
            : current.settings,
          singlePlaceMode: input.singlePlaceMode ?? current.singlePlaceMode,
          updatedAt: now,
        })
        .where(eq(instanceSettings.id, 1))
        .returning();
      await transaction.insert(auditLog).values({
        action: 'instance.settings.updated',
        actorUserId,
        metadata: { after: updated, before: current },
        targetType: 'instance_settings',
      });
      return updated;
    });
  }

  async setAccountStatus(
    actorUserId: string,
    targetUserId: string,
    status: 'active' | 'suspended',
    reasonCode: string,
    reason: string,
    now: Date,
  ) {
    return this.database.transaction(async (transaction) => {
      const [target] = await transaction
        .select({
          id: users.id,
          isInstanceAdmin: users.isInstanceAdmin,
          status: users.status,
        })
        .from(users)
        .where(eq(users.id, targetUserId))
        .limit(1)
        .for('update');
      if (!target) throw new NotFoundException('Account was not found.');
      if (target.id === actorUserId || target.isInstanceAdmin) {
        throw new ConflictException('Instance administrator accounts cannot be changed here.');
      }
      const [updated] = await transaction
        .update(users)
        .set({ status, updatedAt: now })
        .where(eq(users.id, targetUserId))
        .returning({ id: users.id, status: users.status });
      if (status === 'suspended') {
        await transaction
          .update(sessions)
          .set({ revokedAt: now })
          .where(and(eq(sessions.userId, targetUserId), isNull(sessions.revokedAt)));
      }
      const actionName = status === 'suspended' ? 'account.suspend' : 'account.restore';
      await transaction.insert(moderationActions).values({
        action: actionName,
        actorUserId,
        after: { status },
        before: { status: target.status },
        reason: reason.trim(),
        reasonCode,
        targetId: targetUserId,
        targetType: 'account',
      });
      await transaction.insert(auditLog).values({
        action: actionName,
        actorUserId,
        metadata: {
          after: { status },
          before: { status: target.status },
          reason: reason.trim(),
          reasonCode,
        },
        targetId: targetUserId,
        targetType: 'account',
      });
      await transaction.insert(notifications).values({
        payload: { reasonCode, status },
        type: actionName,
        userId: targetUserId,
      });
      return updated;
    });
  }
}