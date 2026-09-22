import { AssetsRepository } from '../../src/assets/assets.repository.js';
import {
  startDatabaseTestContext,
  type DatabaseTestContext,
} from '../factories/database-test-context.js';
import { withRollback } from '../factories/transaction-fixture.js';

describe('asset persistence', () => {
  let context: DatabaseTestContext;

  beforeAll(async () => {
    context = await startDatabaseTestContext();
  });

  afterAll(async () => {
    await context?.stop();
  });

  it('reserves quotas atomically and completes an intent idempotently within its place', async () => {
    await withRollback(context.pool, async (fixture) => {
      const owner = await fixture.createUser();
      const firstPlace = await fixture.createPlace(owner.id);
      const secondPlace = await fixture.createPlace(owner.id);
      const repository = new AssetsRepository(fixture.database);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 15 * 60 * 1_000);
      const first = await repository.reserveIntent(
        {
          expectedMimeType: 'image/png',
          expectedSizeBytes: 1_000,
          expiresAt,
          objectKey: `uploads/${firstPlace.id}/first`,
          originalFileName: 'first.png',
          placeId: firstPlace.id,
          userId: owner.id,
        },
        { placeBytes: 10_000, userBytes: 1_500 },
        now,
      );
      expect(first.quotaExceeded).toBeUndefined();
      if (!first.intent) throw new Error('Expected an upload intent.');

      await expect(
        repository.reserveIntent(
          {
            expectedMimeType: 'image/png',
            expectedSizeBytes: 600,
            expiresAt,
            objectKey: `uploads/${firstPlace.id}/second`,
            originalFileName: 'second.png',
            placeId: firstPlace.id,
            userId: owner.id,
          },
          { placeBytes: 10_000, userBytes: 1_500 },
          now,
        ),
      ).resolves.toEqual({ quotaExceeded: 'user' });
      await expect(
        repository.findIntent(first.intent.id, secondPlace.id),
      ).resolves.toBeUndefined();

      const asset = await repository.completeIntent(
        first.intent.id,
        firstPlace.id,
        now,
      );
      await expect(
        repository.completeIntent(first.intent.id, firstPlace.id, now),
      ).resolves.toEqual(asset);
      await expect(
        repository.findAsset(asset.id, secondPlace.id),
      ).resolves.toBeUndefined();

      await repository.markReady(asset.id, 'image/png', 'skipped', {}, []);
      await expect(
        repository.setUserImage(
          firstPlace.id,
          owner.id,
          'avatar',
          asset.id,
          now,
        ),
      ).resolves.toMatchObject({ assetId: asset.id, kind: 'avatar' });
      await expect(
        repository.setPlaceImage(firstPlace.id, 'icon', asset.id, now),
      ).resolves.toMatchObject({ assetId: asset.id, kind: 'icon' });
      await expect(
        repository.setPlaceImage(secondPlace.id, 'icon', asset.id, now),
      ).resolves.toBeUndefined();
      await expect(
        repository.findUserImage(firstPlace.id, owner.id, 'avatar'),
      ).resolves.toMatchObject({ assetId: asset.id, kind: 'avatar' });
      await expect(
        repository.findPlaceImage(firstPlace.id, 'icon'),
      ).resolves.toMatchObject({ assetId: asset.id, kind: 'icon' });
      await expect(
        repository.findPlaceImage(secondPlace.id, 'icon'),
      ).resolves.toBeUndefined();
    });
  });
});
