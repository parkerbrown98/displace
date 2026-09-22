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

  @ApiPropertyOptional({ minimum: 0 })
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
  @IsUUID('7')
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