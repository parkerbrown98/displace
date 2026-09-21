import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import {
  assets,
  assetVariants,
  placeProfileAssets,
  uploadIntents,
  userProfileAssets,
} from '../database/schema/index.js';
import { UploadIntentExpiredError } from './assets.types.js';
import type {
  AssetRecord,
  AssetsRepositoryPort,
  CreateUploadIntentRecord,
  UploadIntentRecord,
} from './assets.types.js';

@Injectable()
export class AssetsRepository implements AssetsRepositoryPort {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async reserveIntent(
    input: CreateUploadIntentRecord,
    limits: { placeBytes: number; userBytes: number },
    now: Date,
  ) {
    return this.database.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${input.placeId}, 0))`,
      );
      const [assetUsage] = await transaction
        .select({
          placeBytes: sql<number>`coalesce(sum(${assets.sizeBytes}), 0)::int`,
          userBytes: sql<number>`coalesce(sum(case when ${assets.uploadedByUserId} = ${input.userId} then ${assets.sizeBytes} else 0 end), 0)::int`,
        })
        .from(assets)
        .where(
          and(
            eq(assets.placeId, input.placeId),
            inArray(assets.status, ['quarantined', 'processing', 'ready']),
          ),
        );
      const [pendingUsage] = await transaction
        .select({
          placeBytes: sql<number>`coalesce(sum(${uploadIntents.expectedSizeBytes}), 0)::int`,
          userBytes: sql<number>`coalesce(sum(case when ${uploadIntents.userId} = ${input.userId} then ${uploadIntents.expectedSizeBytes} else 0 end), 0)::int`,
        })
        .from(uploadIntents)
        .where(
          and(
            eq(uploadIntents.placeId, input.placeId),
            eq(uploadIntents.status, 'pending'),
            gt(uploadIntents.expiresAt, now),
          ),
        );
      const userBytes =
        (assetUsage?.userBytes ?? 0) + (pendingUsage?.userBytes ?? 0);
      const placeBytes =
        (assetUsage?.placeBytes ?? 0) + (pendingUsage?.placeBytes ?? 0);
      if (userBytes + input.expectedSizeBytes > limits.userBytes) {
        return { quotaExceeded: 'user' as const };
      }
      if (placeBytes + input.expectedSizeBytes > limits.placeBytes) {
        return { quotaExceeded: 'place' as const };
      }
      const [intent] = await transaction
        .insert(uploadIntents)
        .values(input)
        .returning();
      if (!intent)
        throw new Error('Upload intent creation did not return a record.');
      return { intent: this.toIntent(intent) };
    });
  }

  async findIntent(intentId: string, placeId: string) {
    const [row] = await this.database
      .select({ assetId: assets.id, intent: uploadIntents })
      .from(uploadIntents)
      .leftJoin(assets, eq(assets.uploadIntentId, uploadIntents.id))
      .where(
        and(eq(uploadIntents.id, intentId), eq(uploadIntents.placeId, placeId)),
      )
      .limit(1);
    return row ? this.toIntent(row.intent, row.assetId) : undefined;
  }

  async completeIntent(
    intentId: string,
    placeId: string,
    now: Date,
  ): Promise<AssetRecord> {
    return this.database.transaction(async (transaction) => {
      const [intent] = await transaction
        .select()
        .from(uploadIntents)
        .where(
          and(
            eq(uploadIntents.id, intentId),
            eq(uploadIntents.placeId, placeId),
          ),
        )
        .for('update')
        .limit(1);
      if (!intent)
        throw new Error('Upload intent disappeared during completion.');
      const [existing] = await transaction
        .select()
        .from(assets)
        .where(eq(assets.uploadIntentId, intentId))
        .limit(1);
      if (existing) return existing;
      if (intent.status !== 'pending') {
        throw new Error('Upload intent changed state during completion.');
      }
      if (intent.expiresAt <= now) throw new UploadIntentExpiredError();
      const [asset] = await transaction
        .insert(assets)
        .values({
          declaredMimeType: intent.expectedMimeType,
          objectKey: intent.objectKey,
          originalFileName: intent.originalFileName,
          placeId,
          sizeBytes: intent.expectedSizeBytes,
          uploadedByUserId: intent.userId,
          uploadIntentId: intent.id,
        })
        .returning();
      if (!asset) throw new Error('Asset creation did not return a record.');
      await transaction
        .update(uploadIntents)
        .set({ completedAt: now, status: 'completed' })
        .where(eq(uploadIntents.id, intentId));
      return asset;
    });
  }

  async findAsset(assetId: string, placeId: string) {
    const [asset] = await this.database
      .select()
      .from(assets)
      .where(and(eq(assets.id, assetId), eq(assets.placeId, placeId)))
      .limit(1);
    return asset;
  }

  async setUserImage(
    placeId: string,
    userId: string,
    kind: 'avatar' | 'banner',
    assetId: string,
    now: Date,
  ) {
    const [asset] = await this.database
      .select({ id: assets.id })
      .from(assets)
      .where(
        and(
          eq(assets.id, assetId),
          eq(assets.placeId, placeId),
          eq(assets.uploadedByUserId, userId),
          eq(assets.status, 'ready'),
          inArray(assets.detectedMimeType, [
            'image/jpeg',
            'image/png',
            'image/webp',
          ]),
        ),
      )
      .limit(1);
    if (!asset) return undefined;
    const [reference] = await this.database
      .insert(userProfileAssets)
      .values({ assetId, kind, placeId, updatedAt: now, userId })
      .onConflictDoUpdate({
        target: [userProfileAssets.userId, userProfileAssets.kind],
        set: { assetId, placeId, updatedAt: now },
      })
      .returning();
    return reference;
  }

  async setPlaceImage(
    placeId: string,
    kind: 'icon' | 'banner',
    assetId: string,
    now: Date,
  ) {
    const [asset] = await this.database
      .select({ id: assets.id })
      .from(assets)
      .where(
        and(
          eq(assets.id, assetId),
          eq(assets.placeId, placeId),
          eq(assets.status, 'ready'),
          inArray(assets.detectedMimeType, [
            'image/jpeg',
            'image/png',
            'image/webp',
          ]),
        ),
      )
      .limit(1);
    if (!asset) return undefined;
    const [reference] = await this.database
      .insert(placeProfileAssets)
      .values({ assetId, kind, placeId, updatedAt: now })
      .onConflictDoUpdate({
        target: [placeProfileAssets.placeId, placeProfileAssets.kind],
        set: { assetId, updatedAt: now },
      })
      .returning();
    return reference;
  }

  async beginProcessing(assetId: string, placeId: string) {
    return this.database.transaction(async (transaction) => {
      const [asset] = await transaction
        .select()
        .from(assets)
        .where(and(eq(assets.id, assetId), eq(assets.placeId, placeId)))
        .for('update')
        .limit(1);
      if (!asset || asset.status === 'ready' || asset.status === 'rejected')
        return undefined;
      if (asset.status === 'processing') return asset;
      const [processing] = await transaction
        .update(assets)
        .set({ status: 'processing' })
        .where(eq(assets.id, assetId))
        .returning();
      return processing;
    });
  }

  async markReady(
    assetId: string,
    detectedMimeType: string,
    scanStatus: 'clean' | 'skipped',
    metadata: Record<string, unknown>,
    variants: Array<{
      height: number;
      kind: string;
      mimeType: string;
      objectKey: string;
      sizeBytes: number;
      width: number;
    }>,
  ): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const [asset] = await transaction
        .update(assets)
        .set({
          detectedMimeType,
          metadata,
          readyAt: new Date(),
          scanStatus,
          status: 'ready',
        })
        .where(eq(assets.id, assetId))
        .returning({ placeId: assets.placeId });
      if (!asset) throw new Error('Asset disappeared during processing.');
      if (variants.length > 0) {
        await transaction.insert(assetVariants).values(
          variants.map((variant) => ({
            ...variant,
            assetId,
            placeId: asset.placeId,
          })),
        );
      }
    });
  }

  async markRejected(
    assetId: string,
    scanStatus: 'failed' | 'infected',
  ): Promise<void> {
    await this.database
      .update(assets)
      .set({ scanStatus, status: 'rejected' })
      .where(eq(assets.id, assetId));
  }

  async claimExpiredIntents(now: Date, limit = 100) {
    return this.database.transaction(async (transaction) => {
      const pending = await transaction
        .select({ id: uploadIntents.id })
        .from(uploadIntents)
        .where(
          and(
            eq(uploadIntents.status, 'pending'),
            lt(uploadIntents.expiresAt, now),
          ),
        )
        .orderBy(uploadIntents.expiresAt, uploadIntents.id)
        .for('update', { skipLocked: true })
        .limit(limit);
      if (pending.length > 0) {
        await transaction
          .update(uploadIntents)
          .set({ status: 'expired' })
          .where(
            inArray(
              uploadIntents.id,
              pending.map(({ id }) => id),
            ),
          );
      }
      return transaction
        .select()
        .from(uploadIntents)
        .where(
          and(
            eq(uploadIntents.status, 'expired'),
            isNull(uploadIntents.cleanedAt),
            or(
              inArray(
                uploadIntents.id,
                pending.map(({ id }) => id),
              ),
              lt(uploadIntents.expiresAt, now),
            ),
          ),
        )
        .orderBy(uploadIntents.expiresAt, uploadIntents.id)
        .limit(limit);
    });
  }

  async markIntentCleaned(intentId: string, cleanedAt: Date): Promise<void> {
    await this.database
      .update(uploadIntents)
      .set({ cleanedAt })
      .where(
        and(
          eq(uploadIntents.id, intentId),
          eq(uploadIntents.status, 'expired'),
        ),
      );
  }

  private toIntent(
    intent: typeof uploadIntents.$inferSelect,
    assetId: string | null = null,
  ): UploadIntentRecord {
    return { ...intent, assetId };
  }
}
