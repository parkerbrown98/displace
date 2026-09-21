import { randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { AccessTokenService } from '../../src/auth/access-token.service.js';
import {
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

describe('places lifecycle', () => {
  let app: NestFastifyApplication;
  let context: DatabaseTestContext;

  beforeAll(async () => {
    context = await startDatabaseTestContext();
    const redisUrl = `redis://:${context.redis.options.password}@${context.redis.options.host}:${context.redis.options.port}`;
    app = await createTestApplication({
      environment: {
        ACCESS_TOKEN_SECRET:
          'places-integration-access-token-secret-at-least-32-bytes',
        DATABASE_URL: context.environment.DATABASE_URL,
        REDIS_URL: redisUrl,
        REFRESH_TOKEN_PEPPER:
          'places-integration-refresh-token-pepper-at-least-32-bytes',
      },
    });
  });

  afterAll(async () => {
    await app?.close();
    await context?.stop();
  });

  it('enforces place visibility, membership policies, role hierarchy, and ownership', async () => {
    const owner = await createIdentity('owner');
    const member = await createIdentity('member');
    const invitee = await createIdentity('invitee');
    const pendingMember = await createIdentity('pending');

    const created = await app.inject({
      headers: bearer(owner),
      method: 'POST',
      payload: { name: 'Open Place', slug: `open-${suffix()}` },
      url: '/api/v1/places',
    });
    expect(created.statusCode).toBe(201);
    const openPlace = created.json<{ id: string; slug: string }>();

    const anonymousRead = await app.inject({
      method: 'GET',
      url: `/api/v1/places/${openPlace.slug}`,
    });
    expect(anonymousRead.statusCode).toBe(200);
    expect(anonymousRead.json()).not.toHaveProperty('viewer');

    const filteredDiscovery = await app.inject({
      method: 'GET',
      url: '/api/v1/places?q=Open%20Place&joinPolicy=open',
    });
    expect(filteredDiscovery.statusCode).toBe(200);
    expect(filteredDiscovery.json<{ items: Array<{ id: string }> }>().items).toEqual([
      expect.objectContaining({ id: openPlace.id }),
    ]);

    const anonymousContext = await app.inject({
      method: 'GET',
      url: `/api/v1/places/${openPlace.id}/context`,
    });
    expect(anonymousContext.statusCode).toBe(401);

    const ownerContext = await app.inject({
      headers: bearer(owner),
      method: 'GET',
      url: `/api/v1/places/${openPlace.id}/context`,
    });
    expect(ownerContext.statusCode).toBe(200);
    expect(ownerContext.json()).toMatchObject({
      place: { id: openPlace.id },
      viewer: {
        isOwner: true,
        memberId: expect.any(String),
        permissions: expect.arrayContaining(['place.manage', 'role.manage']),
      },
    });

    const rolesResponse = await app.inject({
      headers: bearer(owner),
      method: 'GET',
      url: `/api/v1/places/${openPlace.id}/roles`,
    });
    expect(rolesResponse.statusCode).toBe(200);
    const systemRoles = rolesResponse.json<{
      items: Array<{
        id: string;
        isSystem: boolean;
        name: string;
        permissions: string[];
        position: number;
      }>;
    }>().items;
    expect(systemRoles.map((role) => role.name)).toEqual([
      'Member',
      'Moderator',
      'Admin',
      'Owner',
    ]);
    expect(systemRoles.every((role) => role.isSystem)).toBe(true);
    expect(
      systemRoles.find((role) => role.name === 'Owner')?.permissions,
    ).toContain('place.manage');

    const joined = await app.inject({
      headers: bearer(member),
      method: 'POST',
      payload: {},
      url: `/api/v1/places/${openPlace.id}/join`,
    });
    expect(joined.statusCode).toBe(200);
    expect(joined.json()).toEqual({
      memberId: expect.any(String),
      status: 'active',
    });

    const memberPlaces = await app.inject({
      headers: bearer(member),
      method: 'GET',
      url: '/api/v1/places/mine',
    });
    expect(memberPlaces.statusCode).toBe(200);
    expect(memberPlaces.json<{ items: Array<{ id: string }> }>().items).toContainEqual(
      expect.objectContaining({ id: openPlace.id }),
    );

    const repeatJoin = await app.inject({
      headers: bearer(member),
      method: 'POST',
      payload: {},
      url: `/api/v1/places/${openPlace.id}/join`,
    });
    expect(repeatJoin.statusCode).toBe(200);
    expect(repeatJoin.json()).toMatchObject({ status: 'active' });

    const membersResponse = await app.inject({
      headers: bearer(owner),
      method: 'GET',
      url: `/api/v1/places/${openPlace.id}/members?status=active`,
    });
    expect(membersResponse.statusCode).toBe(200);
    const members = membersResponse.json<{
      items: Array<{ id: string; userId: string }>;
    }>().items;
    const memberRecord = members.find((item) => item.userId === member.id);
    expect(memberRecord).toBeDefined();

    const adminRole = systemRoles.find((role) => role.name === 'Admin')!;
    const assigned = await app.inject({
      headers: bearer(owner),
      method: 'POST',
      payload: { roleId: adminRole.id },
      url: `/api/v1/places/${openPlace.id}/members/${memberRecord!.id}/roles`,
    });
    expect(assigned.statusCode).toBe(200);

    const memberContext = await app.inject({
      headers: bearer(member),
      method: 'GET',
      url: `/api/v1/places/${openPlace.id}/context`,
    });
    expect(memberContext.statusCode).toBe(200);
    expect(memberContext.json()).toMatchObject({
      viewer: {
        isOwner: false,
        memberId: memberRecord!.id,
        permissions: expect.arrayContaining(['member.manage', 'role.manage']),
      },
    });

    const escalatedRole = await app.inject({
      headers: bearer(member),
      method: 'POST',
      payload: {
        name: 'Peer Admin',
        permissions: ['role.manage'],
        position: 80,
      },
      url: `/api/v1/places/${openPlace.id}/roles`,
    });
    expect(escalatedRole.statusCode).toBe(403);

    const settings = await app.inject({
      headers: bearer(owner),
      method: 'PATCH',
      payload: { settings: { locale: 'en-US', topicSort: 'activity' } },
      url: `/api/v1/places/${openPlace.id}/settings`,
    });
    expect(settings.statusCode).toBe(200);
    expect(settings.json()).toMatchObject({
      settings: { locale: 'en-US', topicSort: 'activity' },
    });

    const approval = await createPlace(owner, {
      joinPolicy: 'approval',
      name: 'Approval Place',
      slug: `approval-${suffix()}`,
    });
    const requested = await app.inject({
      headers: bearer(invitee),
      method: 'POST',
      payload: {},
      url: `/api/v1/places/${approval.id}/join`,
    });
    expect(requested.statusCode).toBe(200);
    const request = requested.json<{ memberId: string; status: string }>();
    expect(request.status).toBe('pending');
    const approved = await app.inject({
      headers: bearer(owner),
      method: 'POST',
      url: `/api/v1/places/${approval.id}/members/${request.memberId}/approve`,
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json()).toMatchObject({ status: 'active' });
    const pendingRequest = await app.inject({
      headers: bearer(pendingMember),
      method: 'POST',
      payload: {},
      url: `/api/v1/places/${approval.id}/join`,
    });
    expect(pendingRequest.statusCode).toBe(200);
    const pendingMemberId = pendingRequest.json<{ memberId: string }>().memberId;
    const memberDefaultList = await app.inject({
      headers: bearer(invitee),
      method: 'GET',
      url: `/api/v1/places/${approval.id}/members`,
    });
    expect(memberDefaultList.statusCode).toBe(200);
    expect(
      memberDefaultList.json<{ items: Array<{ id: string }> }>().items,
    ).not.toContainEqual(expect.objectContaining({ id: pendingMemberId }));
    const forbiddenPendingList = await app.inject({
      headers: bearer(invitee),
      method: 'GET',
      url: `/api/v1/places/${approval.id}/members?status=pending`,
    });
    expect(forbiddenPendingList.statusCode).toBe(403);
    const managedPendingList = await app.inject({
      headers: bearer(owner),
      method: 'GET',
      url: `/api/v1/places/${approval.id}/members?status=pending`,
    });
    expect(managedPendingList.statusCode).toBe(200);
    expect(
      managedPendingList.json<{ items: Array<{ id: string }> }>().items,
    ).toContainEqual(expect.objectContaining({ id: pendingMemberId }));

    const banned = await app.inject({
      headers: bearer(owner),
      method: 'POST',
      payload: { reason: 'Integration test ban', userId: invitee.id },
      url: `/api/v1/places/${approval.id}/bans`,
    });
    expect(banned.statusCode).toBe(201);
    const ban = banned.json<{ id: string }>();
    const bannedJoin = await app.inject({
      headers: bearer(invitee),
      method: 'POST',
      payload: {},
      url: `/api/v1/places/${approval.id}/join`,
    });
    expect(bannedJoin.statusCode).toBe(403);
    const activeBans = await app.inject({
      headers: bearer(owner),
      method: 'GET',
      url: `/api/v1/places/${approval.id}/bans`,
    });
    expect(activeBans.statusCode).toBe(200);
    expect(
      activeBans.json<{ items: Array<{ userId: string }> }>().items,
    ).toContainEqual(
      expect.objectContaining({ userId: invitee.id }),
    );
    const unbanned = await app.inject({
      headers: bearer(owner),
      method: 'DELETE',
      url: `/api/v1/places/${approval.id}/bans/${ban.id}`,
    });
    expect(unbanned.statusCode).toBe(204);

    const inviteOnly = await createPlace(owner, {
      joinPolicy: 'invite_only',
      name: 'Invite Place',
      slug: `invite-${suffix()}`,
      visibility: 'private',
    });
    const hidden = await app.inject({
      method: 'GET',
      url: `/api/v1/places/${inviteOnly.id}`,
    });
    expect(hidden.statusCode).toBe(404);
    const rejectedJoin = await app.inject({
      headers: bearer(member),
      method: 'POST',
      payload: {},
      url: `/api/v1/places/${inviteOnly.id}/join`,
    });
    expect(rejectedJoin.statusCode).toBe(403);
    const invite = await app.inject({
      headers: bearer(owner),
      method: 'POST',
      payload: { maxUses: 1 },
      url: `/api/v1/places/${inviteOnly.id}/invites`,
    });
    expect(invite.statusCode).toBe(201);
    const inviteToken = invite.json<{ token: string }>().token;
    const accepted = await app.inject({
      headers: bearer(member),
      method: 'POST',
      payload: { token: inviteToken },
      url: `/api/v1/places/${inviteOnly.id}/invites/accept`,
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toEqual({
      memberId: expect.any(String),
      status: 'active',
    });
    const reused = await app.inject({
      headers: bearer(invitee),
      method: 'POST',
      payload: { token: inviteToken },
      url: `/api/v1/places/${inviteOnly.id}/invites/accept`,
    });
    expect(reused.statusCode).toBe(400);

    const approvalRoles = await app.inject({
      headers: bearer(owner),
      method: 'GET',
      url: `/api/v1/places/${approval.id}/roles`,
    });
    const foreignRoleId = approvalRoles
      .json<{ items: Array<{ id: string; name: string }> }>()
      .items
      .find((role) => role.name === 'Member')!.id;
    const crossPlaceAssignment = await app.inject({
      headers: bearer(owner),
      method: 'POST',
      payload: { roleId: foreignRoleId },
      url: `/api/v1/places/${openPlace.id}/members/${memberRecord!.id}/roles`,
    });
    expect(crossPlaceAssignment.statusCode).toBe(404);

    await app.inject({
      headers: bearer(invitee),
      method: 'POST',
      payload: {},
      url: `/api/v1/places/${openPlace.id}/join`,
    });
    const refreshedMembers = await app.inject({
      headers: bearer(owner),
      method: 'GET',
      url: `/api/v1/places/${openPlace.id}/members?status=active`,
    });
    const inviteeMemberId = refreshedMembers
      .json<{ items: Array<{ id: string; userId: string }> }>()
      .items.find((item) => item.userId === invitee.id)!.id;
    const malformedMemberRead = await app.inject({
      headers: bearer(owner),
      method: 'GET',
      url: `/api/v1/places/${openPlace.id}/members/not-a-uuid`,
    });
    expect(malformedMemberRead.statusCode).toBe(400);
    const inviteCreatorResponse = await app.inject({
      headers: bearer(owner),
      method: 'POST',
      payload: {
        name: 'Invite Creator',
        permissions: ['member.manage'],
        position: 35,
      },
      url: `/api/v1/places/${openPlace.id}/roles`,
    });
    const roleManagerResponse = await app.inject({
      headers: bearer(owner),
      method: 'POST',
      payload: {
        name: 'Role Manager',
        permissions: ['role.manage'],
        position: 40,
      },
      url: `/api/v1/places/${openPlace.id}/roles`,
    });
    const restrictedRoleResponse = await app.inject({
      headers: bearer(owner),
      method: 'POST',
      payload: {
        name: 'Restricted Grant',
        permissions: ['place.manage'],
        position: 30,
      },
      url: `/api/v1/places/${openPlace.id}/roles`,
    });
    expect(inviteCreatorResponse.statusCode).toBe(201);
    expect(roleManagerResponse.statusCode).toBe(201);
    expect(restrictedRoleResponse.statusCode).toBe(201);
    await app.inject({
      headers: bearer(owner),
      method: 'POST',
      payload: { roleId: inviteCreatorResponse.json<{ id: string }>().id },
      url: `/api/v1/places/${openPlace.id}/members/${inviteeMemberId}/roles`,
    });
    const ordinaryInvite = await app.inject({
      headers: bearer(invitee),
      method: 'POST',
      payload: { maxUses: 1 },
      url: `/api/v1/places/${openPlace.id}/invites`,
    });
    expect(ordinaryInvite.statusCode).toBe(201);
    const forbiddenRoleInvite = await app.inject({
      headers: bearer(invitee),
      method: 'POST',
      payload: {
        maxUses: 1,
        roleId: restrictedRoleResponse.json<{ id: string }>().id,
      },
      url: `/api/v1/places/${openPlace.id}/invites`,
    });
    expect(forbiddenRoleInvite.statusCode).toBe(403);
    await app.inject({
      headers: bearer(owner),
      method: 'POST',
      payload: { roleId: roleManagerResponse.json<{ id: string }>().id },
      url: `/api/v1/places/${openPlace.id}/members/${inviteeMemberId}/roles`,
    });
    const forbiddenGrant = await app.inject({
      headers: bearer(invitee),
      method: 'POST',
      payload: { roleId: restrictedRoleResponse.json<{ id: string }>().id },
      url: `/api/v1/places/${openPlace.id}/members/${inviteeMemberId}/roles`,
    });
    expect(forbiddenGrant.statusCode).toBe(403);

    const transfer = await app.inject({
      headers: bearer(owner),
      method: 'POST',
      payload: { userId: member.id },
      url: `/api/v1/places/${openPlace.id}/ownership`,
    });
    expect(transfer.statusCode).toBe(204);
    const formerOwnerLeaves = await app.inject({
      headers: bearer(owner),
      method: 'DELETE',
      url: `/api/v1/places/${openPlace.id}/members/me`,
    });
    expect(formerOwnerLeaves.statusCode).toBe(204);
    const currentOwnerCannotLeave = await app.inject({
      headers: bearer(member),
      method: 'DELETE',
      url: `/api/v1/places/${openPlace.id}/members/me`,
    });
    expect(currentOwnerCannotLeave.statusCode).toBe(409);

    const configuredSlug = `single-${suffix()}`;
    const redisUrl = `redis://:${context.redis.options.password}@${context.redis.options.host}:${context.redis.options.port}`;
    const singlePlaceApp = await createTestApplication({
      environment: {
        ACCESS_TOKEN_SECRET:
          'places-integration-access-token-secret-at-least-32-bytes',
        DATABASE_URL: context.environment.DATABASE_URL,
        REDIS_URL: redisUrl,
        REFRESH_TOKEN_PEPPER:
          'places-integration-refresh-token-pepper-at-least-32-bytes',
        SINGLE_PLACE_MODE: true,
        SINGLE_PLACE_SLUG: configuredSlug,
      },
    });
    try {
      const rejectedCreation = await singlePlaceApp.inject({
        headers: bearer(owner),
        method: 'POST',
        payload: { name: 'Wrong Place', slug: `wrong-${suffix()}` },
        url: '/api/v1/places',
      });
      expect(rejectedCreation.statusCode).toBe(403);
      const singleCreated = await singlePlaceApp.inject({
        headers: bearer(owner),
        method: 'POST',
        payload: { name: 'Configured Place', slug: configuredSlug },
        url: '/api/v1/places',
      });
      expect(singleCreated.statusCode).toBe(201);
      const discovery = await singlePlaceApp.inject({
        method: 'GET',
        url: '/api/v1/places',
      });
      expect(discovery.statusCode).toBe(200);
      expect(
        discovery.json<{ items: Array<{ slug: string }> }>().items,
      ).toEqual([expect.objectContaining({ slug: configuredSlug })]);
    } finally {
      await singlePlaceApp.close();
    }
  });

  async function createIdentity(prefix: string): Promise<TestIdentity> {
    const value = suffix();
    const [user] = await context.database
      .insert(users)
      .values({ displayName: `${prefix} ${value}`, handle: `${prefix}_${value}` })
      .returning({ id: users.id });
    if (!user) {
      throw new Error('Test user was not returned.');
    }
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
    if (!session) {
      throw new Error('Test session was not returned.');
    }
    return {
      accessToken: await app
        .get(AccessTokenService)
        .issue(user.id, session.id),
      id: user.id,
    };
  }

  async function createPlace(
    identity: TestIdentity,
    input: Record<string, unknown>,
  ): Promise<{ id: string }> {
    const response = await app.inject({
      headers: bearer(identity),
      method: 'POST',
      payload: input,
      url: '/api/v1/places',
    });
    expect(response.statusCode).toBe(201);
    return response.json<{ id: string }>();
  }
});

function bearer(identity: TestIdentity) {
  return { authorization: `Bearer ${identity.accessToken}` };
}

function suffix(): string {
  return randomUUID().replaceAll('-', '').slice(0, 10);
}