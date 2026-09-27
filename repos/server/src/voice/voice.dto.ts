import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  PLACE_PERMISSIONS,
  type PlacePermission,
} from '../places/place-permissions.js';

export class CreateVoiceRoomDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @Length(1, 120)
  @Matches(/\S/)
  name: string;

  @ApiProperty({ maxLength: 80 })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug: string;

  @ApiPropertyOptional({ default: 0, minimum: 0, type: Number })
  @IsInt()
  @Min(0)
  @IsOptional()
  position = 0;

  @ApiPropertyOptional({ default: 25, maximum: 500, minimum: 1, type: Number })
  @IsInt()
  @Min(1)
  @Max(500)
  @IsOptional()
  capacity = 25;

  @ApiPropertyOptional({ default: 'voice.join', enum: PLACE_PERMISSIONS })
  @IsEnum(PLACE_PERMISSIONS)
  @IsOptional()
  listenPermission: PlacePermission = 'voice.join';

  @ApiPropertyOptional({ default: 'voice.join', enum: PLACE_PERMISSIONS })
  @IsEnum(PLACE_PERMISSIONS)
  @IsOptional()
  speakPermission: PlacePermission = 'voice.join';
}

export class UpdateVoiceRoomDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsString()
  @Length(1, 120)
  @Matches(/\S/)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  position?: number;

  @ApiPropertyOptional({ maximum: 500, minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(500)
  @IsOptional()
  capacity?: number;

  @ApiPropertyOptional({ enum: PLACE_PERMISSIONS })
  @IsEnum(PLACE_PERMISSIONS)
  @IsOptional()
  listenPermission?: PlacePermission;

  @ApiPropertyOptional({ enum: PLACE_PERMISSIONS })
  @IsEnum(PLACE_PERMISSIONS)
  @IsOptional()
  speakPermission?: PlacePermission;
}

export class VoiceParticipantDto {
  @ApiProperty()
  canPublish: boolean;
  @ApiProperty()
  displayName: string;
  @ApiProperty()
  identity: string;
  @ApiProperty({ format: 'date-time' })
  joinedAt: string;
  @ApiProperty()
  microphoneMuted: boolean;
}

export class VoiceRoomDto {
  @ApiProperty()
  archived: boolean;
  @ApiProperty()
  canJoin: boolean;
  @ApiProperty()
  canManage: boolean;
  @ApiProperty()
  canSpeak: boolean;
  @ApiProperty()
  capacity: number;
  @ApiProperty({ format: 'uuid' })
  id: string;
  @ApiProperty({ enum: PLACE_PERMISSIONS })
  listenPermission: PlacePermission;
  @ApiProperty()
  name: string;
  @ApiProperty({ isArray: true, type: VoiceParticipantDto })
  participants: VoiceParticipantDto[];
  @ApiProperty({ format: 'uuid' })
  placeId: string;
  @ApiProperty()
  position: number;
  @ApiProperty()
  slug: string;
  @ApiProperty({ enum: PLACE_PERMISSIONS })
  speakPermission: PlacePermission;
}

export class VoiceJoinDto {
  @ApiProperty()
  canPublish: boolean;
  @ApiProperty({ format: 'date-time' })
  expiresAt: Date;
  @ApiProperty()
  roomName: string;
  @ApiProperty()
  serverUrl: string;
  @ApiProperty()
  token: string;
}