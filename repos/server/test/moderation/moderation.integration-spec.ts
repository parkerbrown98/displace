import { randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { and, eq } from 'drizzle-orm';
import { AccessTokenService } from '../../src/auth/access-token.service.js';
import {
  auditLog,
  memberSanctions,
  moderationActions,
  moderationReports,
  moderatorNotes,
  notifications,
  sessions,
  userEmails,
  users,
} from '../../src/database/schema/index.js';
import {
  startDatabaseTestContext,
  type DatabaseTestContext,
} from '../factories/database-test-context.js';
import { createTestApplication } from '../factories/test-application.js';

interface TestIdentity {
  accessToken: string;
  id: string;
}

describe('moderation and instance administration', () => {
  let app: NestFastifyApplication;
  let context: DatabaseTestContext;

  beforeAll(async () => {
    context = await startDatabaseTestContext();
    const redisUrl = `redis://:${context.redis.options.password}@${context.redis.options.host}:${context.redis.options.port}`;
    app = await createTestApplication({
      environment: {
        ACCESS_TOKEN_SECRET:
          'moderation-integration-access-token-secret-at-least-32-bytes',
        DATABASE_URL: context.environment.DATABASE_URL,
        REDIS_URL: redisUrl,
        REFRESH_TOKEN_PEPPER:
          'moderation-integration-refresh-token-pepper-at-least-32-bytes',
      },
    });
  });

  afterAll(async () => {
    await app?.close();
    await context?.stop();
  });

  it('handles reports, actions, sanctions, audits, settings, and account suspension', async () => {
    const owner = await createIdentity('mod_owner', true);
    const reporter = await createIdentity('reporter');
    const subject = await createIdentity('subject');

    const createdPlace = await app.inject({
      headers: bearer(owner),
      method: 'POST',
      payload: { name: 'Moderated Place', slug: `moderated-${suffix()}` },
      url: '/api/v1/places',
    });
    expect(createdPlace.statusCode).toBe(201);
    const place = createdPlace.json<{ id: string }>();

    for (const identity of [reporter, subject]) {
      const joined = await app.inject({
        headers: bearer(identity),
        method: 'POST',
        payload: {},
        url: `/api/v1/places/${place.id}/join`,
      });
      expect(joined.statusCode).toBe(200);
    }

    const members = await app.inject({
      headers: bearer(owner),
      method: 'GET',
      url: `/api/v1/places/${place.id}/members?status=active`,
    });
    const subjectMember = members
      .json<{ items: Array<{ id: string; userId: string }> }>()
      .items.find((member) => member.userId === subject.id);
    expect(subjectMember).toBeDefined();

    const createdReport = await app.inject({
      headers: bearer(reporter),
      method: 'POST',
      payload: {
        details: 'Repeated unwanted contact in public threads.',
        reasonCode: 'harassment',
        targetId: subjectMember!.id,
        targetType: 'member',
      },
      url: `/api/v1/places/${place.id}/reports`,
    });
    expect(createdReport.statusCode).toBe(201);
    const report = createdReport.json<{ id: string; status: string }>();
    expect(report.status).toBe('open');

    const forbiddenQueue = await app.inject({
      headers: bearer(reporter),
      method: 'GET',
      url: `/api/v1/places/${place.id}/moderation/reports`,
    });
    expect(forbiddenQueue.statusCode).toBe(403);

    const queue = await app.inject({
      headers: bearer(owner),
      method: 'GET',
      url: `/api/v1/places/${place.id}/moderation/reports?status=open`,
    });
    expect(queue.statusCode).toBe(200);
    expect(queue.json()).toMatchObject({
      items: [
        {
          evidence: expect.objectContaining({ handle: expect.any(String) }),
          id: report.id,
          reasonCode: 'harassment',
        },
      ],
    });

    const assigned = await app.inject({
      headers: bearer(owner),
      method: 'PATCH',
      payload: { assigneeUserId: owner.id },
      url: `/api/v1/places/${place.id}/moderation/reports/${report.id}/assignment`,
    });
    expect(assigned.statusCode).toBe(200);
    expect(assigned.json()).toMatchObject({ status: 'in_review' });

    const note = await app.inject({
      headers: bearer(owner),
      method: 'POST',
      payload: { body: 'Reporter history and public evidence reviewed.' },
      url: `/api/v1/places/${place.id}/moderation/reports/${report.id}/notes`,
    });
    expect(note.statusCode).toBe(201);

    const warning = await app.inject({
      headers: bearer(owner),
      method: 'POST',
      payload: {
        action: 'member.warn',
        reason: 'Stop contacting members after they ask you to stop.',
        reasonCode: 'harassment',
        reportId: report.id,
        targetId: subjectMember!.id,
        targetType: 'member',
      },
      url: `/api/v1/places/${place.id}/moderation/actions`,
    });
    expect(warning.statusCode).toBe(201);

    const timeout = await app.inject({
      headers: bearer(owner),
      method: 'POST',
      payload: {
        action: 'member.timeout',
        durationHours: 24,
        reason: 'A cooling-off period is required.',
        reasonCode: 'harassment',
        reportId: report.id,
        targetId: subjectMember!.id,
        targetType: 'member',
      },
      url: `/api/v1/places/${place.id}/moderation/actions`,
    });
    expect(timeout.statusCode).toBe(201);

    const timedOutContext = await app.inject({
      headers: bearer(subject),
      method: 'GET',
      url: `/api/v1/places/${place.id}/context`,
    });
    expect(timedOutContext.statusCode).toBe(200);
    expect(timedOutContext.json()).toMatchObject({
      viewer: { permissions: [] },
    });

    const resolved = await app.inject({
      headers: bearer(owner),
      method: 'PATCH',
      payload: {
        resolution: 'Warning issued and temporary timeout applied.',
        status: 'resolved',
      },
      url: `/api/v1/places/${place.id}/moderation/reports/${report.id}/resolution`,
    });
    expect(resolved.statusCode).toBe(200);
    expect(resolved.json()).toMatchObject({ status: 'resolved' });

    const detail = await app.inject({
      headers: bearer(owner),
      method: 'GET',
      url: `/api/v1/places/${place.id}/moderation/reports/${report.id}`,
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      actions: [
        expect.objectContaining({ action: 'member.warn' }),
        expect.objectContaining({ action: 'member.timeout' }),
      ],
      notes: [expect.objectContaining({ body: expect.stringContaining('reviewed') })],
      status: 'resolved',
    });

    const storedReport = await context.database.query.moderationReports.findFirst({
      where: eq(moderationReports.id, report.id),
    });
    expect(storedReport?.evidence).toMatchObject({ handle: expect.any(String) });
    expect(
      await context.database
        .select()
        .from(memberSanctions)
        .where(eq(memberSanctions.userId, subject.id)),
    ).toHaveLength(2);
    expect(
      await context.database
        .select()
        .from(moderationActions)
        .where(eq(moderationActions.reportId, report.id)),
    ).toHaveLength(2);
    expect(
      await context.database
        .select()
        .from(moderatorNotes)
        .where(eq(moderatorNotes.reportId, report.id)),
    ).toHaveLength(1);
    expect(
      await context.database
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.placeId, place.id), eq(auditLog.targetId, report.id))),
    ).not.toHaveLength(0);
    expect(
      await context.database
        .select()
        .from(notifications)
        .where(eq(notifications.userId, subject.id)),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'moderation.action' }),
      ]),
    );

    const settings = await app.inject({
      headers: bearer(owner),
      method: 'PATCH',
      payload: {
        registrationMode: 'invite_only',
        settings: {
          features: { uploads: true },
          publicPolicyUrls: { terms: 'https://example.test/terms' },
        },
      },
      url: '/api/v1/admin/settings',
    });
    expect(settings.statusCode).toBe(200);
    expect(settings.json()).toMatchObject({
      registrationMode: 'invite_only',
      settings: { features: { uploads: true } },
    });

    const rejectedSecret = await app.inject({
      headers: bearer(owner),
      method: 'PATCH',
      payload: { settings: { smtpPassword: 'must-not-be-stored' } },
      url: '/api/v1/admin/settings',
    });
    expect(rejectedSecret.statusCode).toBe(400);

    const suspended = await app.inject({
      headers: bearer(owner),
      method: 'POST',
      payload: {
        reason: 'Instance safety review.',
        reasonCode: 'safety',
      },
      url: `/api/v1/admin/users/${subject.id}/suspend`,
    });
    expect(suspended.statusCode).toBe(201);
    expect(suspended.json()).toMatchObject({ status: 'suspended' });

    const rejectedSession = await app.inject({
      headers: bearer(subject),
      method: 'GET',
      url: '/api/v1/auth/me',
    });
    expect(rejectedSession.statusCode).toBe(401);

    const restored = await app.inject({
      headers: bearer(owner),
      method: 'POST',
      payload: {
        reason: 'Safety review completed.',
        reasonCode: 'safety',
      },
      url: `/api/v1/admin/users/${subject.id}/restore`,
    });
    expect(restored.statusCode).toBe(201);
    expect(restored.json()).toMatchObject({ status: 'active' });
  });

  async function createIdentity(
    prefix: string,
    isInstanceAdmin = false,
  ): Promise<TestIdentity> {
    const value = suffix();
    const [user] = await context.database
      .insert(users)
      .values({
        displayName: `${prefix} ${value}`,
        handle: `${prefix}_${value}`,
        isInstanceAdmin,
      })
      .returning({ id: users.id });
    if (!user) throw new Error('Test user was not returned.');
    await context.database.insert(userEmails).values({
      email: `${prefix}-${value}@example.test`,
      isPrimary: true,
      userId: user.id,
      verifiedAt: new Date(),
    });
    const [session] = await context.database
      .insert(sessions)
      .values({
        expiresAt: new Date(Date.now() + 60 * 60 * 1_000),
        refreshTokenHash: `test-${randomUUID()}`,
        userId: user.id,
      })
      .returning({ id: sessions.id });
    if (!session) throw new Error('Test session was not returned.');
    return {
      accessToken: await app.get(AccessTokenService).issue(user.id, session.id),
      id: user.id,
    };
  }
});

function bearer(identity: TestIdentity) {
  return { authorization: `Bearer ${identity.accessToken}` };
}

function suffix(): string {
  return randomUUID().replaceAll('-', '').slice(0, 10);
}