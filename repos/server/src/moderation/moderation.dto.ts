import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const REPORT_REASON_CODES = [
  'spam',
  'harassment',
  'hate',
  'dangerous',
  'sexual',
  'privacy',
  'impersonation',
  'other',
] as const;

export const ACTION_REASON_CODES = [
  'policy_violation',
  'spam',
  'harassment',
  'hate',
  'safety',
  'ban_evasion',
  'other',
] as const;

export enum ReportTargetTypeDto {
  ChatMessage = 'chat_message',
  Member = 'member',
  Place = 'place',
  Post = 'post',
  Topic = 'topic',
}

export enum ReportStatusDto {
  Dismissed = 'dismissed',
  InReview = 'in_review',
  Open = 'open',
  Resolved = 'resolved',
}

export enum ModerationActionDto {
  Ban = 'member.ban',
  ChatDelete = 'chat.delete',
  ContentHide = 'content.hide',
  ContentRestore = 'content.restore',
  Timeout = 'member.timeout',
  TopicLock = 'topic.lock',
  TopicMove = 'topic.move',
  TopicPin = 'topic.pin',
  TopicUnlock = 'topic.unlock',
  TopicUnpin = 'topic.unpin',
  Warn = 'member.warn',
}

export class ModerationCursorQueryDto {
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

  @ApiPropertyOptional({ enum: ReportStatusDto })
  @IsEnum(ReportStatusDto)
  @IsOptional()
  status?: ReportStatusDto;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  assigneeUserId?: string;
}

export class CreateReportDto {
  @ApiProperty({ enum: ReportTargetTypeDto })
  @IsEnum(ReportTargetTypeDto)
  targetType: ReportTargetTypeDto;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  targetId: string;

  @ApiProperty({ enum: REPORT_REASON_CODES })
  @IsIn(REPORT_REASON_CODES)
  reasonCode: (typeof REPORT_REASON_CODES)[number];

  @ApiPropertyOptional({ maxLength: 4_000, type: String })
  @IsString()
  @MaxLength(4_000)
  @IsOptional()
  details = '';
}

export class AssignReportDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  assigneeUserId: string;
}

export class ResolveReportDto {
  @ApiProperty({ enum: [ReportStatusDto.Resolved, ReportStatusDto.Dismissed] })
  @IsIn([ReportStatusDto.Resolved, ReportStatusDto.Dismissed])
  status: ReportStatusDto.Resolved | ReportStatusDto.Dismissed;

  @ApiProperty({ maxLength: 4_000, minLength: 1 })
  @IsString()
  @Length(1, 4_000)
  @Matches(/\S/)
  resolution: string;
}

export class AddModeratorNoteDto {
  @ApiProperty({ maxLength: 4_000, minLength: 1 })
  @IsString()
  @Length(1, 4_000)
  @Matches(/\S/)
  body: string;
}

export class CreateModerationActionDto {
  @ApiProperty({ enum: ModerationActionDto })
  @IsEnum(ModerationActionDto)
  action: ModerationActionDto;

  @ApiProperty({ enum: ReportTargetTypeDto })
  @IsEnum(ReportTargetTypeDto)
  targetType: ReportTargetTypeDto;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  targetId: string;

  @ApiProperty({ enum: ACTION_REASON_CODES })
  @IsIn(ACTION_REASON_CODES)
  reasonCode: (typeof ACTION_REASON_CODES)[number];

  @ApiProperty({ maxLength: 4_000, minLength: 1 })
  @IsString()
  @Length(1, 4_000)
  @Matches(/\S/)
  reason: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  reportId?: string;

  @ApiPropertyOptional({ maximum: 8_760, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8_760)
  @IsOptional()
  durationHours?: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  targetForumId?: string;
}

export class BulkModerationActionDto {
  @ApiProperty({ isArray: true, type: CreateModerationActionDto })
  @IsArray()
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => CreateModerationActionDto)
  actions: CreateModerationActionDto[];
}

export enum RegistrationModeDto {
  Closed = 'closed',
  InviteOnly = 'invite_only',
  Open = 'open',
}

export class UpdateInstanceSettingsDto {
  @ApiPropertyOptional({ enum: RegistrationModeDto })
  @IsEnum(RegistrationModeDto)
  @IsOptional()
  registrationMode?: RegistrationModeDto;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  singlePlaceMode?: boolean;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsObject()
  @IsOptional()
  settings?: Record<string, unknown>;
}

export class AccountStatusActionDto {
  @ApiProperty({ enum: ACTION_REASON_CODES })
  @IsIn(ACTION_REASON_CODES)
  reasonCode: (typeof ACTION_REASON_CODES)[number];

  @ApiProperty({ maxLength: 4_000, minLength: 1 })
  @IsString()
  @Length(1, 4_000)
  @Matches(/\S/)
  reason: string;
}

export class ModeratorNoteDto {
  @ApiProperty({ format: 'uuid' })
  id: string;
  @ApiProperty({ format: 'uuid' })
  reportId: string;
  @ApiProperty({ format: 'uuid' })
  placeId: string;
  @ApiProperty({ format: 'uuid' })
  authorUserId: string;
  @ApiProperty()
  body: string;
  @ApiProperty({ format: 'date-time' })
  createdAt: Date;
}

export class ModerationActionRecordDto {
  @ApiProperty({ format: 'uuid' })
  id: string;
  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  placeId: string | null;
  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  reportId: string | null;
  @ApiProperty({ format: 'uuid' })
  actorUserId: string;
  @ApiProperty()
  targetType: string;
  @ApiProperty({ format: 'uuid' })
  targetId: string;
  @ApiProperty({ enum: ModerationActionDto })
  action: ModerationActionDto;
  @ApiProperty({ enum: ACTION_REASON_CODES })
  reasonCode: (typeof ACTION_REASON_CODES)[number];
  @ApiProperty()
  reason: string;
  @ApiProperty({ additionalProperties: true, type: 'object' })
  before: Record<string, unknown>;
  @ApiProperty({ additionalProperties: true, type: 'object' })
  after: Record<string, unknown>;
  @ApiProperty({ format: 'date-time' })
  createdAt: Date;
}

export class ModerationReportDto {
  @ApiProperty({ format: 'uuid' })
  id: string;
  @ApiProperty({ format: 'uuid' })
  placeId: string;
  @ApiProperty({ format: 'uuid' })
  reporterUserId: string;
  @ApiProperty({ enum: ReportTargetTypeDto })
  targetType: ReportTargetTypeDto;
  @ApiProperty({ format: 'uuid' })
  targetId: string;
  @ApiProperty({ enum: REPORT_REASON_CODES })
  reasonCode: (typeof REPORT_REASON_CODES)[number];
  @ApiProperty()
  details: string;
  @ApiProperty({ additionalProperties: true, type: 'object' })
  evidence: Record<string, unknown>;
  @ApiProperty({ enum: ReportStatusDto })
  status: ReportStatusDto;
  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  assignedToUserId: string | null;
  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  resolvedByUserId: string | null;
  @ApiProperty({ nullable: true, type: String })
  resolution: string | null;
  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  resolvedAt: Date | null;
  @ApiProperty({ format: 'date-time' })
  createdAt: Date;
  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;
}

export class ModerationReportDetailDto extends ModerationReportDto {
  @ApiProperty({ isArray: true, type: ModerationActionRecordDto })
  actions: ModerationActionRecordDto[];
  @ApiProperty({ isArray: true, type: ModeratorNoteDto })
  notes: ModeratorNoteDto[];
}

export class ModerationReportPageDto {
  @ApiProperty({ isArray: true, type: ModerationReportDto })
  items: ModerationReportDto[];
  @ApiPropertyOptional()
  nextCursor?: string;
}

export class ModerationActionResultDto {
  @ApiProperty({ format: 'uuid' })
  actionId: string;
  @ApiPropertyOptional({ format: 'uuid' })
  targetUserId?: string;
}

export class BulkModerationActionResultDto {
  @ApiProperty({ isArray: true, type: ModerationActionResultDto })
  items: ModerationActionResultDto[];
}

export class InstanceSettingsDto {
  @ApiProperty()
  id: number;
  @ApiProperty({ enum: RegistrationModeDto })
  registrationMode: RegistrationModeDto;
  @ApiProperty()
  singlePlaceMode: boolean;
  @ApiProperty({ additionalProperties: true, type: 'object' })
  settings: Record<string, unknown>;
  @ApiProperty({ format: 'date-time' })
  createdAt: Date;
  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;
  @ApiPropertyOptional()
  bootstrapAdminConfigured?: boolean;
  @ApiPropertyOptional()
  secretsManagedExternally?: boolean;
}

export class AccountStatusDto {
  @ApiProperty({ format: 'uuid' })
  id: string;
  @ApiProperty({ enum: ['active', 'suspended'] })
  status: 'active' | 'suspended';
}