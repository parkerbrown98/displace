import { randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { AccessTokenService } from '../../src/auth/access-token.service.js';
import { sessions, userEmails, users } from '../../src/database/schema/index.js';
import { VoiceLiveKitService, type VoiceParticipant } from '../../src/voice/voice-livekit.service.js';
import { startDatabaseTestContext, type DatabaseTestContext } from '../factories/database-test-context.js';
import { createTestApplication } from '../factories/test-application.js';

interface TestIdentity { accessToken: string; id: string }

describe('voice lifecycle', () => {
  let app: NestFastifyApplication;
  let context: DatabaseTestContext;
  let participants: VoiceParticipant[] = [];
  const livekit = {
    createJoinToken: vi.fn().mockResolvedValue('voice-join-token'),
    ensureRoom: vi.fn((placeId: string, roomId: string) => Promise.resolve(`voice:${placeId}:${roomId}`)),
    listParticipants: vi.fn(() => Promise.resolve(participants)),
    parseRoomName: vi.fn(),
    receiveWebhook: vi.fn(),
    removeParticipant: vi.fn(),
    serverUrl: 'ws://livekit.test',
    updateParticipantPermissions: vi.fn(),
  };

  beforeAll(async () => {
    context = await startDatabaseTestContext();
    const redisUrl = `redis://:${context.redis.options.password}@${context.redis.options.host}:${context.redis.options.port}`;
    app = await createTestApplication({
      environment: {
        ACCESS_TOKEN_SECRET: 'voice-integration-access-token-secret-at-least-32-bytes',
        DATABASE_URL: context.environment.DATABASE_URL,
        REDIS_URL: redisUrl,
        REFRESH_TOKEN_PEPPER: 'voice-integration-refresh-token-pepper-at-least-32-bytes',
      },
      providerOverrides: [{ token: VoiceLiveKitService, value: livekit }],
    });
  });

  afterAll(async () => { await app?.close(); await context?.stop(); });

  beforeEach(() => { participants = []; vi.clearAllMocks(); });

  it('enforces management, listening, publishing, capacity, and archival policy', async () => {
    const owner = await createIdentity('voice_owner');
    const member = await createIdentity('voice_member');
    const placeResponse = await app.inject({ headers: bearer(owner), method: 'POST', payload: { name: 'Voice Place', slug: `voice-${suffix()}` }, url: '/api/v1/places' });
    expect(placeResponse.statusCode).toBe(201);
    const place = placeResponse.json<{ id: string }>();

    const joined = await app.inject({ headers: bearer(member), method: 'POST', payload: {}, url: `/api/v1/places/${place.id}/join` });
    expect(joined.statusCode).toBe(200);

    const forbiddenCreate = await app.inject({ headers: bearer(member), method: 'POST', payload: { name: 'Nope', slug: 'nope' }, url: `/api/v1/places/${place.id}/voice/rooms` });
    expect(forbiddenCreate.statusCode).toBe(403);

    const created = await app.inject({
      headers: bearer(owner),
      method: 'POST',
      payload: { capacity: 2, listenPermission: 'voice.join', name: 'Lounge', position: 3, slug: 'lounge', speakPermission: 'voice.manage' },
      url: `/api/v1/places/${place.id}/voice/rooms`,
    });
    expect(created.statusCode).toBe(201);
    const room = created.json<{ id: string }>();

    const listed = await app.inject({ headers: bearer(member), method: 'GET', url: `/api/v1/places/${place.id}/voice/rooms` });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toEqual([expect.objectContaining({ canJoin: true, canManage: false, canSpeak: false, name: 'Lounge', participants: [] })]);

    const token = await app.inject({ headers: bearer(member), method: 'POST', url: `/api/v1/places/${place.id}/voice/rooms/${room.id}/join-token` });
    expect(token.statusCode).toBe(200);
    expect(token.json()).toMatchObject({ canPublish: false, serverUrl: 'ws://livekit.test', token: 'voice-join-token' });
    expect(livekit.createJoinToken).toHaveBeenCalledWith(expect.objectContaining({ canPublish: false, identity: member.id }));

    participants = [participant(owner.id), participant(randomUUID())];
    const full = await app.inject({ headers: bearer(member), method: 'POST', url: `/api/v1/places/${place.id}/voice/rooms/${room.id}/join-token` });
    expect(full.statusCode).toBe(409);

    const updated = await app.inject({ headers: bearer(owner), method: 'PATCH', payload: { capacity: 5, name: 'Main Lounge', position: 1 }, url: `/api/v1/places/${place.id}/voice/rooms/${room.id}` });
    expect(updated.statusCode, updated.body).toBe(200);
    expect(updated.json()).toMatchObject({ capacity: 5, name: 'Main Lounge', position: 1 });

    livekit.receiveWebhook.mockResolvedValue({ room: { name: `voice:${place.id}:${room.id}` } });
    livekit.parseRoomName.mockReturnValue({ placeId: place.id, roomId: room.id });
    const webhook = await app.inject({
      headers: { authorization: 'Bearer signed-livekit-webhook', 'content-type': 'application/webhook+json' },
      method: 'POST',
      payload: JSON.stringify({ event: 'participant_joined' }),
      url: '/api/v1/voice/webhook',
    });
    expect(webhook.statusCode).toBe(204);
    expect(livekit.receiveWebhook).toHaveBeenCalledWith(expect.stringContaining('participant_joined'), 'Bearer signed-livekit-webhook');

    participants = [];
    const banned = await app.inject({
      headers: bearer(owner),
      method: 'POST',
      payload: { reason: 'Voice policy violation', userId: member.id },
      url: `/api/v1/places/${place.id}/bans`,
    });
    expect(banned.statusCode).toBe(201);
    const bannedJoin = await app.inject({ headers: bearer(member), method: 'POST', url: `/api/v1/places/${place.id}/voice/rooms/${room.id}/join-token` });
    expect(bannedJoin.statusCode).toBe(403);

    const archived = await app.inject({ headers: bearer(owner), method: 'DELETE', url: `/api/v1/places/${place.id}/voice/rooms/${room.id}` });
    expect(archived.statusCode).toBe(204);
    const afterArchive = await app.inject({ headers: bearer(owner), method: 'GET', url: `/api/v1/places/${place.id}/voice/rooms` });
    expect(afterArchive.json()).toEqual([]);
  });

  async function createIdentity(prefix: string): Promise<TestIdentity> {
    const value = suffix();
    const [user] = await context.database.insert(users).values({ displayName: `${prefix} ${value}`, handle: `${prefix}_${value}` }).returning({ id: users.id });
    if (!user) throw new Error('Test user was not returned.');
    await context.database.insert(userEmails).values({ email: `${prefix}-${value}@example.test`, isPrimary: true, userId: user.id, verifiedAt: new Date() });
    const [session] = await context.database.insert(sessions).values({ expiresAt: new Date(Date.now() + 3_600_000), refreshTokenHash: `test-${randomUUID()}`, userId: user.id }).returning({ id: sessions.id });
    if (!session) throw new Error('Test session was not returned.');
    return { accessToken: await app.get(AccessTokenService).issue(user.id, session.id), id: user.id };
  }
});

function bearer(identity: TestIdentity) { return { authorization: `Bearer ${identity.accessToken}` }; }
function suffix() { return randomUUID().replaceAll('-', '').slice(0, 10); }
function participant(identity: string): VoiceParticipant { return { canPublish: true, displayName: identity, identity, joinedAt: new Date().toISOString(), microphoneMuted: false }; }