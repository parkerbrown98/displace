import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export enum ApiTokenScope {
  Read = 'read',
  Write = 'write',
  Moderation = 'moderation',
  Administration = 'administration',
}

export class CreateApiTokenDto {
  @ApiProperty({ example: 'Local development' })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty({ enum: ApiTokenScope, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsEnum(ApiTokenScope, { each: true })
  scopes: ApiTokenScope[];

  @ApiProperty({ example: '2027-09-26T00:00:00.000Z', format: 'date-time' })
  @IsDateString()
  expiresAt: string;
}

export class RotateApiTokenDto {
  @ApiPropertyOptional({ example: '2027-09-26T00:00:00.000Z', format: 'date-time' })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}

export class ApiTokenDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  prefix: string;

  @ApiProperty({ enum: ApiTokenScope, isArray: true })
  scopes: ApiTokenScope[];

  @ApiProperty({ format: 'date-time' })
  expiresAt: string;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  lastUsedAt: string | null;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  revokedAt: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export class IssuedApiTokenDto extends ApiTokenDto {
  @ApiProperty({ description: 'Shown once. Store this secret securely.' })
  token: string;
}
