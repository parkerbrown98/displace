import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service.js';
import { TokenHashService } from '../auth/token-hash.service.js';
import type { AppEnvironment } from '../config/environment.js';
import { CLOCK, type Clock } from '../platform/clock/clock.js';
import { CursorCodecService } from '../platform/pagination/cursor-codec.service.js';
import {
  TOKEN_GENERATOR,
  type TokenGenerator,
} from '../platform/tokens/token-generator.js';
import {
  MembershipsRepository,
  type MembershipResourceCursor,
} from './memberships.repository.js';
import type { PlacePermission } from './place-permissions.js';
import {
  type CreateInviteDto,
  type CreateBanDto,
  type CreatePlaceDto,
  type CreateRoleDto,
  type CursorQueryDto,
  type PlaceDiscoveryQueryDto,
  type UpdatePlaceDto,
  type UpdateRoleDto,
} from './places.dto.js';
import {
  PlacesRepository,
  type PlaceAuthorizationRecord,
  type PlaceCursor,
} from './places.repository.js';
import { RolesRepository, type RoleCursor } from './roles.repository.js';

@Injectable()
export class PlacesService {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<AppEnvironment, true>,
    private readonly cursors: CursorCodecService,
    private readonly memberships: MembershipsRepository,
    private readonly places: PlacesRepository,
    private readonly roles: RolesRepository,
    private readonly tokenHashes: TokenHashService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(TOKEN_GENERATOR) private readonly tokenGenerator: TokenGenerator,
  ) {}

  async create(userId: string, input: CreatePlaceDto) {
    await this.requireVerified(userId);
    if (
      this.config.get('SINGLE_PLACE_MODE', { infer: true }) &&
      input.slug !== this.config.get('SINGLE_PLACE_SLUG', { infer: true })
    ) {
      throw new ForbiddenException('Only the configured place can be created.');
    }
    try {
      return await this.places.create(userId, input, this.clock.now());
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('A place with that slug already exists.');
      }
      throw error;
    }
  }

  async discover(query: PlaceDiscoveryQueryDto) {
    const cursor = query.cursor ? this.decodeCursor(query.cursor) : undefined;
    const singlePlaceSlug = this.config.get('SINGLE_PLACE_MODE', { infer: true })
      ? this.config.get('SINGLE_PLACE_SLUG', { infer: true })
      : undefined;
    const [records, tags] = await Promise.all([
      this.places.listPublic({
        cursor,
        joinPolicy: query.joinPolicy,
        limit: query.limit,
        query: query.q?.trim() || undefined,
        singlePlaceSlug,
        tag: query.tag,
      }),
      this.places.listPublicTagFacets(singlePlaceSlug),
    ]);
    const hasMore = records.length > query.limit;
    const items = records.slice(0, query.limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        hasMore && last
          ? this.cursors.encode({
              createdAt: last.createdAt.toISOString(),
              id: last.id,
            })
          : undefined,
          tags,
    };
  }

  async listMine(userId: string, query: CursorQueryDto) {
    const cursor = query.cursor ? this.decodeCursor(query.cursor) : undefined;
    const records = await this.places.listForUser(userId, {
      cursor,
      limit: query.limit,
      singlePlaceSlug: this.config.get('SINGLE_PLACE_MODE', { infer: true })
        ? this.config.get('SINGLE_PLACE_SLUG', { infer: true })
        : undefined,
    });
    const hasMore = records.length > query.limit;
    const items = records.slice(0, query.limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        hasMore && last
          ? this.cursors.encode({
              createdAt: last.createdAt.toISOString(),
              id: last.id,
            })
          : undefined,
    };
  }

  async get(identifier: string, userId?: string) {
    const place = await this.requirePlace(identifier);
    if (place.visibility !== 'public') {
      if (!userId || !(await this.places.getAuthorization(place.id, userId))) {
        throw new NotFoundException('Place was not found.');
      }
    }
    return place;
  }

  async getContext(placeId: string, userId: string) {
    const [place, authorization] = await Promise.all([
      this.requirePlace(placeId),
      this.requireAuthorization(placeId, userId),
    ]);
    return {
      place,
      viewer: {
        isOwner: authorization.isOwner,
        memberId: authorization.memberId,
        permissions: [...authorization.permissions].sort(),
      },
    };
  }

  async update(placeId: string, userId: string, input: UpdatePlaceDto) {
    await this.requireVerified(userId);
    const place = await this.places.update(placeId, input, userId, this.clock.now());
    if (!place) {
      throw new NotFoundException('Place was not found.');
    }
    return place;
  }

  async updateSettings(
    placeId: string,
    userId: string,
    settings: Record<string, unknown>,
  ) {
    await this.requireVerified(userId);
    return this.places.updateSettings(
      placeId,
      this.normalizeSettings(settings),
      userId,
      this.clock.now(),
    );
  }

  private normalizeSettings(settings: Record<string, unknown>) {
    if (settings.tags === undefined) return settings;
    if (!Array.isArray(settings.tags) || settings.tags.length > 8) {
      throw new BadRequestException('Discovery tags must contain at most 8 items.');
    }
    const tags = [...new Set(settings.tags.map((value) => {
      if (typeof value !== 'string') {
        throw new BadRequestException('Discovery tags must be strings.');
      }
      const tag = value.trim().toLowerCase().replace(/\s+/g, '-');
      if (tag.length < 2 || tag.length > 24 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag)) {
        throw new BadRequestException('Discovery tags must use 2-24 letters, numbers, or hyphens.');
      }
      return tag;
    }))];
    return { ...settings, tags };
  }

  async archive(placeId: string, userId: string): Promise<void> {
    await this.requireVerified(userId);
    if (!(await this.places.archive(placeId, userId, this.clock.now()))) {
      throw new NotFoundException('Place was not found.');
    }
  }

  async join(
    identifier: string,
    userId: string,
    inviteToken?: string,
  ) {
    await this.requireVerified(userId);
    const place = await this.requirePlace(identifier);
    const result = await this.memberships.join(
      place.id,
      userId,
      inviteToken ? this.tokenHashes.hash(inviteToken) : undefined,
      this.clock.now(),
    );
    if (result.kind === 'banned') {
      throw new ForbiddenException('You cannot join this place.');
    }
    if (result.kind === 'invite-required') {
      throw new ForbiddenException('A valid invite is required.');
    }
    if (result.kind === 'invalid-invite') {
      throw new BadRequestException('The invite is invalid or expired.');
    }
    return { memberId: result.memberId, status: result.status };
  }

  async leave(placeId: string, userId: string): Promise<void> {
    await this.requireVerified(userId);
    const result = await this.memberships.leave(placeId, userId, this.clock.now());
    if (result === 'owner') {
      throw new ConflictException('Transfer ownership before leaving.');
    }
    if (result === 'missing') {
      throw new NotFoundException('Membership was not found.');
    }
  }

  async listMembers(
    placeId: string,
    userId: string,
    query: CursorQueryDto & { q?: string; sort?: 'joined' | 'last_seen'; status?: 'pending' | 'active' },
  ) {
    const authorization = await this.requireAuthorization(placeId, userId);
    if (
      query.status === 'pending' &&
      !authorization.permissions.has('member.manage')
    ) {
      throw new ForbiddenException('Member management is required.');
    }
    const cursor = query.cursor ? this.decodeCursor(query.cursor) : undefined;
    const records = await this.places.listMembers(placeId, {
      cursor,
      limit: query.limit,
      query: query.q?.trim(),
      sort: query.sort,
      status: query.status ?? 'active',
    });
    const hasMore = records.length > query.limit;
    const items = records.slice(0, query.limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        query.sort !== 'last_seen' && hasMore && last
          ? this.cursors.encode({
              createdAt: last.createdAt.toISOString(),
              id: last.id,
            })
          : undefined,
    };
  }

  async getMember(placeId: string, memberId: string, userId?: string) {
    const authorization = userId
      ? await this.requireAuthorization(placeId, userId)
      : undefined;
    const member = await this.places.findMember(placeId, memberId);
    if (!member) {
      throw new NotFoundException('Membership was not found.');
    }
    if (
      authorization &&
      member.status !== 'active' &&
      member.userId !== userId &&
      !authorization.permissions.has('member.manage')
    ) {
      throw new NotFoundException('Membership was not found.');
    }
    return member;
  }

  async approve(placeId: string, memberId: string, actorUserId: string) {
    await this.requireVerified(actorUserId);
    if (
      !(await this.memberships.approve(
        placeId,
        memberId,
        actorUserId,
        this.clock.now(),
      ))
    ) {
      throw new NotFoundException('Pending membership was not found.');
    }
    return this.getMember(placeId, memberId);
  }

  async removeMember(placeId: string, memberId: string, actorUserId: string) {
    await this.requireVerified(actorUserId);
    const actor = await this.requireAuthorization(placeId, actorUserId);
    const target = await this.getMember(placeId, memberId);
    this.requireHigherThan(actor, Math.max(0, ...target.roles.map((role) => role.position)));
    const result = await this.memberships.remove(
      placeId,
      memberId,
      actorUserId,
      this.clock.now(),
    );
    if (result === 'owner') {
      throw new ConflictException('The place owner cannot be removed.');
    }
    if (result === 'missing') {
      throw new NotFoundException('Membership was not found.');
    }
  }

  async transferOwnership(
    placeId: string,
    actorUserId: string,
    newOwnerUserId: string,
  ): Promise<void> {
    await this.requireVerified(actorUserId);
    const authorization = await this.requireAuthorization(placeId, actorUserId);
    if (!authorization.isOwner) {
      throw new ForbiddenException('Only the owner can transfer ownership.');
    }
    if (
      !(await this.memberships.transferOwnership(
        placeId,
        actorUserId,
        newOwnerUserId,
        this.clock.now(),
      ))
    ) {
      throw new BadRequestException('The new owner must be an active member.');
    }
  }

  async createInvite(
    placeId: string,
    actorUserId: string,
    input: CreateInviteDto,
  ) {
    await this.requireVerified(actorUserId);
    if (input.roleId) {
      const actor = await this.requireAuthorization(placeId, actorUserId);
      const role = await this.requireRole(placeId, input.roleId);
      this.requireRoleGrantAllowed(
        actor,
        role.position,
        role.permissions as PlacePermission[],
      );
    }
    const token = this.tokenGenerator.generate(32);
    const invite = await this.memberships.createInvite(placeId, actorUserId, {
      email: input.email,
      expiresAt: new Date(
        this.clock.now().getTime() + input.expiresInHours * 60 * 60 * 1_000,
      ),
      maxUses: input.maxUses,
      roleId: input.roleId,
      tokenHash: this.tokenHashes.hash(token),
    });
    if (!invite) {
      throw new Error('Invite creation did not return an invite.');
    }
    return { ...invite, token };
  }

  async listInvites(
    placeId: string,
    actorUserId: string,
    query: CursorQueryDto,
  ) {
    const records = await this.memberships.listInvites(
      placeId,
      actorUserId,
      this.clock.now(),
      {
        cursor: query.cursor ? this.decodeCursor(query.cursor) : undefined,
        limit: query.limit,
      },
    );
    return this.timePage(records, query.limit);
  }

  async createBan(
    placeId: string,
    actorUserId: string,
    input: CreateBanDto,
  ) {
    await this.requireVerified(actorUserId);
    const actor = await this.requireAuthorization(placeId, actorUserId);
    const target = await this.places.findMemberByUserId(placeId, input.userId);
    if (target) {
      this.requireHigherThan(
        actor,
        Math.max(0, ...target.roles.map((role) => role.position)),
      );
    }
    try {
      const result = await this.memberships.ban(
        placeId,
        input.userId,
        actorUserId,
        input.reason,
        input.expiresInHours
          ? new Date(
              this.clock.now().getTime() +
                input.expiresInHours * 60 * 60 * 1_000,
            )
          : undefined,
        this.clock.now(),
      );
      if (result.kind === 'owner') {
        throw new ConflictException('The place owner cannot be banned.');
      }
      if (result.kind === 'duplicate') {
        throw new ConflictException('The user already has an active ban.');
      }
      return result.record;
    } catch (error) {
      if (this.isForeignKeyViolation(error)) {
        throw new NotFoundException('User was not found.');
      }
      throw error;
    }
  }

  async listBans(placeId: string, actorUserId: string, query: CursorQueryDto) {
    const records = await this.memberships.listBans(
      placeId,
      actorUserId,
      this.clock.now(),
      {
        cursor: query.cursor ? this.decodeCursor(query.cursor) : undefined,
        limit: query.limit,
      },
    );
    return this.timePage(records, query.limit);
  }

  async revokeBan(
    placeId: string,
    banId: string,
    actorUserId: string,
  ): Promise<void> {
    await this.requireVerified(actorUserId);
    if (
      !(await this.memberships.revokeBan(
        placeId,
        banId,
        actorUserId,
        this.clock.now(),
      ))
    ) {
      throw new NotFoundException('Ban was not found.');
    }
  }

  async revokeInvite(
    placeId: string,
    inviteId: string,
    actorUserId: string,
  ): Promise<void> {
    await this.requireVerified(actorUserId);
    if (
      !(await this.memberships.revokeInvite(
        placeId,
        inviteId,
        actorUserId,
        this.clock.now(),
      ))
    ) {
      throw new NotFoundException('Invite was not found.');
    }
  }

  async listRoles(
    placeId: string,
    userId: string,
    query: CursorQueryDto,
  ) {
    await this.requireAuthorization(placeId, userId);
    const records = await this.roles.list(placeId, {
      cursor: query.cursor ? this.decodeRoleCursor(query.cursor) : undefined,
      limit: query.limit,
    });
    const hasMore = records.length > query.limit;
    const items = records.slice(0, query.limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        hasMore && last
          ? this.cursors.encode({ id: last.id, position: last.position })
          : undefined,
    };
  }

  async createRole(
    placeId: string,
    actorUserId: string,
    input: CreateRoleDto,
  ) {
    await this.requireVerified(actorUserId);
    const actor = await this.requireAuthorization(placeId, actorUserId);
    this.requireRoleGrantAllowed(actor, input.position, input.permissions);
    try {
      return await this.roles.create(placeId, actorUserId, input);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('A role with that name already exists.');
      }
      throw error;
    }
  }

  async updateRole(
    placeId: string,
    roleId: string,
    actorUserId: string,
    input: UpdateRoleDto,
  ) {
    await this.requireVerified(actorUserId);
    const actor = await this.requireAuthorization(placeId, actorUserId);
    const current = await this.requireRole(placeId, roleId);
    if (current.isSystem) {
      throw new ConflictException('System roles cannot be changed.');
    }
    this.requireHigherThan(actor, current.position);
    this.requireRoleGrantAllowed(
      actor,
      input.position ?? current.position,
      input.permissions ?? (current.permissions as PlacePermission[]),
    );
    const role = await this.roles.update(
      placeId,
      roleId,
      actorUserId,
      input,
      this.clock.now(),
    );
    if (!role) {
      throw new NotFoundException('Role was not found.');
    }
    return role;
  }

  async deleteRole(placeId: string, roleId: string, actorUserId: string) {
    await this.requireVerified(actorUserId);
    const actor = await this.requireAuthorization(placeId, actorUserId);
    const role = await this.requireRole(placeId, roleId);
    if (role.isSystem) {
      throw new ConflictException('System roles cannot be deleted.');
    }
    this.requireHigherThan(actor, role.position);
    if (!(await this.roles.delete(placeId, roleId, actorUserId))) {
      throw new NotFoundException('Role was not found.');
    }
  }

  async assignRole(
    placeId: string,
    memberId: string,
    roleId: string,
    actorUserId: string,
  ) {
    await this.requireVerified(actorUserId);
    const actor = await this.requireAuthorization(placeId, actorUserId);
    const [role, member] = await Promise.all([
      this.requireRole(placeId, roleId),
      this.getMember(placeId, memberId),
    ]);
    this.requireRoleGrantAllowed(
      actor,
      role.position,
      role.permissions as PlacePermission[],
    );
    this.requireHigherThan(actor, Math.max(0, ...member.roles.map((item) => item.position)));
    if (!(await this.roles.assign(placeId, memberId, roleId, actorUserId))) {
      throw new NotFoundException('Role or active membership was not found.');
    }
    return this.getMember(placeId, memberId);
  }

  async removeRole(
    placeId: string,
    memberId: string,
    roleId: string,
    actorUserId: string,
  ) {
    await this.requireVerified(actorUserId);
    const actor = await this.requireAuthorization(placeId, actorUserId);
    const [role, member] = await Promise.all([
      this.requireRole(placeId, roleId),
      this.getMember(placeId, memberId),
    ]);
    this.requireHigherThan(actor, role.position);
    this.requireHigherThan(actor, Math.max(0, ...member.roles.map((item) => item.position)));
    if (!(await this.roles.remove(placeId, memberId, roleId, actorUserId))) {
      throw new ConflictException('That role assignment cannot be removed.');
    }
    return this.getMember(placeId, memberId);
  }

  private async requireVerified(userId: string): Promise<void> {
    if (!(await this.auth.getProfile(userId)).emailVerified) {
      throw new ForbiddenException('Email verification is required.');
    }
  }

  private async requirePlace(identifier: string) {
    const place = await this.places.findByIdentifier(identifier);
    const configuredSlug = this.config.get('SINGLE_PLACE_SLUG', { infer: true });
    if (
      !place ||
      place.archivedAt ||
      (this.config.get('SINGLE_PLACE_MODE', { infer: true }) &&
        place.slug !== configuredSlug)
    ) {
      throw new NotFoundException('Place was not found.');
    }
    return place;
  }

  private async requireAuthorization(
    placeId: string,
    userId: string,
  ): Promise<PlaceAuthorizationRecord> {
    const authorization = await this.places.getAuthorization(placeId, userId);
    if (!authorization) {
      throw new ForbiddenException('Active place membership is required.');
    }
    return authorization;
  }

  private async requireRole(placeId: string, roleId: string) {
    const role = await this.roles.find(placeId, roleId);
    if (!role) {
      throw new NotFoundException('Role was not found.');
    }
    return role;
  }

  private requireRoleGrantAllowed(
    actor: PlaceAuthorizationRecord,
    position: number,
    permissions: readonly PlacePermission[],
  ): void {
    this.requireHigherThan(actor, position);
    if (!permissions.every((permission) => actor.permissions.has(permission))) {
      throw new ForbiddenException('A role cannot grant permissions you do not have.');
    }
  }

  private requireHigherThan(
    actor: Pick<PlaceAuthorizationRecord, 'position'>,
    targetPosition: number,
  ): void {
    if (targetPosition >= actor.position) {
      throw new ForbiddenException('A higher role position is required.');
    }
  }

  private decodeCursor(cursor: string): PlaceCursor {
    const decoded = this.cursors.decode<{ createdAt: string; id: string }>(cursor);
    const createdAt = new Date(decoded.createdAt);
    if (
      typeof decoded.createdAt !== 'string' ||
      typeof decoded.id !== 'string' ||
      Number.isNaN(createdAt.getTime())
    ) {
      throw new BadRequestException('Cursor is invalid or has been modified.');
    }
    return { createdAt, id: decoded.id };
  }

  private decodeRoleCursor(cursor: string): RoleCursor {
    const decoded = this.cursors.decode<{ id: string; position: number }>(cursor);
    if (
      typeof decoded.id !== 'string' ||
      !Number.isInteger(decoded.position) ||
      decoded.position < 0
    ) {
      throw new BadRequestException('Cursor is invalid or has been modified.');
    }
    return decoded;
  }

  private timePage<
    T extends MembershipResourceCursor,
  >(records: T[], limit: number) {
    const hasMore = records.length > limit;
    const items = records.slice(0, limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        hasMore && last
          ? this.cursors.encode({
              createdAt: last.createdAt.toISOString(),
              id: last.id,
            })
          : undefined,
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return this.hasDatabaseCode(error, '23505');
  }

  private isForeignKeyViolation(error: unknown): boolean {
    return this.hasDatabaseCode(error, '23503');
  }

  private hasDatabaseCode(error: unknown, code: string): boolean {
    let current = error;
    const seen = new Set<unknown>();
    while (typeof current === 'object' && current !== null && !seen.has(current)) {
      if ('code' in current && current.code === code) {
        return true;
      }
      seen.add(current);
      current = 'cause' in current ? current.cause : undefined;
    }
    return false;
  }
}