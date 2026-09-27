import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PLACE_PERMISSIONS, type PlacePermission } from '../places/place-permissions.js';

export enum ChatChannelVisibilityDto {
  Members = 'members',
  Public = 'public',
}

export class ChatCursorQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit = 50;
}

export class CreateChatChannelDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @Length(1, 120)
  @Matches(/\S/)
  name: string;

  @ApiProperty({ maxLength: 80 })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug: string;

  @ApiPropertyOptional({ minimum: 0, type: Number })
  @IsInt()
  @Min(0)
  @IsOptional()
  position = 0;

  @ApiPropertyOptional({ enum: ChatChannelVisibilityDto })
  @IsEnum(ChatChannelVisibilityDto)
  @IsOptional()
  visibility: ChatChannelVisibilityDto = ChatChannelVisibilityDto.Members;

  @ApiPropertyOptional({ enum: PLACE_PERMISSIONS, nullable: true })
  @IsOptional()
  @IsEnum(PLACE_PERMISSIONS)
  readPermission?: PlacePermission;

  @ApiPropertyOptional({ enum: PLACE_PERMISSIONS, nullable: true })
  @IsOptional()
  @IsEnum(PLACE_PERMISSIONS)
  sendPermission?: PlacePermission;
}

export class UpdateChatChannelDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  @Matches(/\S/)
  name?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({ enum: ChatChannelVisibilityDto })
  @IsOptional()
  @IsEnum(ChatChannelVisibilityDto)
  visibility?: ChatChannelVisibilityDto;

  @ApiPropertyOptional({ enum: PLACE_PERMISSIONS, nullable: true })
  @IsOptional()
  @IsEnum(PLACE_PERMISSIONS)
  readPermission?: PlacePermission | null;

  @ApiPropertyOptional({ enum: PLACE_PERMISSIONS, nullable: true })
  @IsOptional()
  @IsEnum(PLACE_PERMISSIONS)
  sendPermission?: PlacePermission | null;
}

export class CreateChatMessageDto {
  @ApiProperty({ maxLength: 4000 })
  @IsString()
  @Length(1, 4000)
  @Matches(/\S/)
  body: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  clientCommandId: string;
}

export class UpdateChatMessageDto {
  @ApiProperty({ maxLength: 4000 })
  @IsString()
  @Length(1, 4000)
  @Matches(/\S/)
  body: string;
}

export class MarkChatReadDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('7')
  messageId: string;
}

export class ChatChannelDto {
  @ApiProperty()
  archived: boolean;
  @ApiProperty({ format: 'uuid' })
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  position: number;
  @ApiProperty({ nullable: true, type: String })
  readPermission: string | null;
  @ApiProperty({ nullable: true, type: String })
  sendPermission: string | null;
  @ApiProperty()
  slug: string;
  @ApiProperty({ enum: ChatChannelVisibilityDto })
  visibility: ChatChannelVisibilityDto;
}

export class ChatMessageAuthorDto {
  @ApiProperty()
  displayName: string;
  @ApiProperty()
  handle: string;
  @ApiProperty({ format: 'uuid' })
  id: string;
}

export class ChatMessageDto {
  @ApiProperty({ type: ChatMessageAuthorDto })
  author: ChatMessageAuthorDto;
  @ApiProperty({ nullable: true, type: String })
  body: string | null;
  @ApiProperty({ format: 'uuid' })
  channelId: string;
  @ApiProperty({ format: 'date-time' })
  createdAt: Date;
  @ApiProperty({ format: 'uuid' })
  id: string;
  @ApiProperty()
  isDeleted: boolean;
  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;
}

export class ChatPermissionsDto {
  @ApiProperty()
  canManage: boolean;
  @ApiProperty()
  canSend: boolean;
}

export class ChatMessagePageDto {
  @ApiProperty({ type: ChatChannelDto })
  channel: ChatChannelDto;
  @ApiProperty({ isArray: true, type: ChatMessageDto })
  items: ChatMessageDto[];
  @ApiPropertyOptional()
  nextCursor?: string;
  @ApiProperty({ type: ChatPermissionsDto })
  permissions: ChatPermissionsDto;
}

export class ChatReadStateDto {
  @ApiProperty({ format: 'uuid' })
  placeId: string;
  @ApiProperty({ format: 'uuid' })
  channelId: string;
  @ApiProperty({ format: 'uuid' })
  userId: string;
  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  lastReadMessageId: string | null;
  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;
}