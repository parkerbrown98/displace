import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationCursorQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit = 25;
}

export class NotificationDto {
  @ApiProperty({ format: 'date-time' })
  createdAt: Date;
  @ApiProperty({ format: 'uuid' })
  id: string;
  @ApiProperty({ additionalProperties: true, type: 'object' })
  payload: Record<string, unknown>;
  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  placeId: string | null;
  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  readAt: Date | null;
  @ApiProperty()
  type: string;
}

export class NotificationPageDto {
  @ApiProperty({ isArray: true, type: NotificationDto })
  items: NotificationDto[];
  @ApiPropertyOptional()
  nextCursor?: string;
  @ApiProperty()
  unreadCount: number;
}