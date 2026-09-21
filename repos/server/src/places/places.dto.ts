import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PLACE_PERMISSIONS, type PlacePermission } from './place-permissions.js';

export enum PlaceVisibilityDto {
  Private = 'private',
  Public = 'public',
  Unlisted = 'unlisted',
}

export enum PlaceJoinPolicyDto {
  Approval = 'approval',
  InviteOnly = 'invite_only',
  Open = 'open',
}

export class CursorQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  cursor?: string;

  @ApiPropertyOptional({ default: 25, maximum: 100, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit = 25;
}

export class PlaceDiscoveryQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ enum: PlaceJoinPolicyDto })
  @IsEnum(PlaceJoinPolicyDto)
  @IsOptional()
  joinPolicy?: PlaceJoinPolicyDto;
}

export class CreatePlaceDto {
  @ApiProperty({ maxLength: 80, minLength: 3 })
  @Length(3, 80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug: string;

  @ApiProperty({ maxLength: 120, minLength: 1 })
  @IsString()
  @Length(1, 120)
  @Matches(/\S/)
  name: string;

  @ApiPropertyOptional({ maxLength: 4_000 })
  @IsString()
  @MaxLength(4_000)
  @IsOptional()
  description = '';

  @ApiPropertyOptional({ enum: PlaceVisibilityDto })
  @IsEnum(PlaceVisibilityDto)
  @IsOptional()
  visibility: PlaceVisibilityDto = PlaceVisibilityDto.Public;

  @ApiPropertyOptional({ enum: PlaceJoinPolicyDto })
  @IsEnum(PlaceJoinPolicyDto)
  @IsOptional()
  joinPolicy: PlaceJoinPolicyDto = PlaceJoinPolicyDto.Open;
}

export class UpdatePlaceDto {
  @ApiPropertyOptional({ maxLength: 120, minLength: 1 })
  @IsString()
  @Length(1, 120)
  @Matches(/\S/)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ maxLength: 4_000 })
  @IsString()
  @MaxLength(4_000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: PlaceVisibilityDto })
  @IsEnum(PlaceVisibilityDto)
  @IsOptional()
  visibility?: PlaceVisibilityDto;

  @ApiPropertyOptional({ enum: PlaceJoinPolicyDto })
  @IsEnum(PlaceJoinPolicyDto)
  @IsOptional()
  joinPolicy?: PlaceJoinPolicyDto;
}

export class UpdatePlaceSettingsDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  settings: Record<string, unknown>;
}

export class PlaceDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  ownerUserId: string;
  @ApiProperty()
  slug: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  description: string;
  @ApiProperty({ enum: PlaceVisibilityDto })
  visibility: PlaceVisibilityDto;
  @ApiProperty({ enum: PlaceJoinPolicyDto })
  joinPolicy: PlaceJoinPolicyDto;
  @ApiProperty({ type: 'object', additionalProperties: true })
  settings: Record<string, unknown>;
  @ApiPropertyOptional({ format: 'date-time' })
  archivedAt: Date | null;
  @ApiProperty({ format: 'date-time' })
  createdAt: Date;
  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;
}

export class PlacePageDto {
  @ApiProperty({ type: PlaceDto, isArray: true })
  items: PlaceDto[];
  @ApiPropertyOptional()
  nextCursor?: string;
}

export class PlaceViewerDto {
  @ApiProperty()
  memberId: string;
  @ApiProperty()
  isOwner: boolean;
  @ApiProperty({ enum: PLACE_PERMISSIONS, isArray: true })
  permissions: string[];
}

export class PlaceContextDto {
  @ApiProperty({ type: PlaceDto })
  place: PlaceDto;
  @ApiProperty({ type: PlaceViewerDto })
  viewer: PlaceViewerDto;
}

export class JoinPlaceDto {
  @ApiPropertyOptional()
  @IsString()
  @MinLength(32)
  @IsOptional()
  inviteToken?: string;
}

export class JoinPlaceResultDto {
  @ApiProperty({ format: 'uuid' })
  memberId: string;

  @ApiProperty({ enum: ['active', 'pending'] })
  status: 'active' | 'pending';
}

export class TransferOwnershipDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId: string;
}

export class CreateInviteDto {
  @ApiPropertyOptional({ format: 'email' })
  @IsEmail()
  @MaxLength(320)
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  roleId?: string;

  @ApiPropertyOptional({ default: 1, maximum: 100, minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  maxUses = 1;

  @ApiPropertyOptional({ default: 168, maximum: 720, minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(720)
  @IsOptional()
  expiresInHours = 168;
}

export class AcceptInviteDto {
  @ApiProperty()
  @IsString()
  @MinLength(32)
  token: string;
}

export class InviteDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  token: string;
  @ApiProperty({ format: 'date-time' })
  expiresAt: Date;
}

export class InviteSummaryDto {
  @ApiProperty()
  id: string;
  @ApiPropertyOptional({ format: 'email' })
  email: string | null;
  @ApiPropertyOptional({ format: 'uuid' })
  roleId: string | null;
  @ApiProperty()
  maxUses: number;
  @ApiProperty()
  useCount: number;
  @ApiProperty({ format: 'date-time' })
  expiresAt: Date;
  @ApiProperty({ format: 'date-time' })
  createdAt: Date;
}

export class InvitePageDto {
  @ApiProperty({ type: InviteSummaryDto, isArray: true })
  items: InviteSummaryDto[];
  @ApiPropertyOptional()
  nextCursor?: string;
}

export class CreateRoleDto {
  @ApiProperty({ maxLength: 80, minLength: 1 })
  @IsString()
  @Length(1, 80)
  @Matches(/\S/)
  name: string;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  position: number;

  @ApiProperty({ enum: PLACE_PERMISSIONS, isArray: true })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(PLACE_PERMISSIONS.length)
  @IsEnum(PLACE_PERMISSIONS, { each: true })
  permissions: PlacePermission[];
}

export class UpdateRoleDto {
  @ApiPropertyOptional({ maxLength: 80, minLength: 1 })
  @IsString()
  @Length(1, 80)
  @Matches(/\S/)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  position?: number;

  @ApiPropertyOptional({ enum: PLACE_PERMISSIONS, isArray: true })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(PLACE_PERMISSIONS.length)
  @IsEnum(PLACE_PERMISSIONS, { each: true })
  @IsOptional()
  permissions?: PlacePermission[];
}

export class RoleDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  position: number;
  @ApiProperty()
  isSystem: boolean;
  @ApiProperty({ enum: PLACE_PERMISSIONS, isArray: true })
  permissions: string[];
}

export class RolePageDto {
  @ApiProperty({ type: RoleDto, isArray: true })
  items: RoleDto[];
  @ApiPropertyOptional()
  nextCursor?: string;
}

export class AssignRoleDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  roleId: string;
}

export class CreateBanDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId: string;

  @ApiProperty({ maxLength: 2_000, minLength: 1 })
  @IsString()
  @Length(1, 2_000)
  @Matches(/\S/)
  reason: string;

  @ApiPropertyOptional({ maximum: 8_760, minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(8_760)
  @IsOptional()
  expiresInHours?: number;
}

export class BanDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  userId: string;
  @ApiProperty()
  reason: string;
  @ApiPropertyOptional({ format: 'date-time' })
  expiresAt: Date | null;
  @ApiProperty({ format: 'date-time' })
  createdAt: Date;
}

export class BanPageDto {
  @ApiProperty({ type: BanDto, isArray: true })
  items: BanDto[];
  @ApiPropertyOptional()
  nextCursor?: string;
}

export class MemberDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  userId: string;
  @ApiProperty()
  handle: string;
  @ApiProperty()
  displayName: string;
  @ApiProperty({ enum: ['pending', 'active', 'left'] })
  status: 'pending' | 'active' | 'left';
  @ApiPropertyOptional({ format: 'date-time' })
  joinedAt: Date | null;
  @ApiProperty({ type: RoleDto, isArray: true })
  roles: RoleDto[];
}

export class MemberPageDto {
  @ApiProperty({ type: MemberDto, isArray: true })
  items: MemberDto[];
  @ApiPropertyOptional()
  nextCursor?: string;
}

export class MemberQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ enum: ['active', 'pending'] })
  @IsIn(['active', 'pending'])
  @IsOptional()
  status?: 'active' | 'pending';
}