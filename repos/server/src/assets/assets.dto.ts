import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateUploadIntentDto {
  @ApiProperty({ example: 'photo.png', maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ example: 'image/png' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  mimeType!: string;

  @ApiProperty({ example: 102400 })
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}

export class UploadIntentDto {
  @ApiProperty({ format: 'date-time' })
  expiresAt!: Date;

  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ additionalProperties: { type: 'string' }, type: 'object' })
  requiredHeaders!: Record<string, string>;

  @ApiProperty({ format: 'uri' })
  uploadUrl!: string;
}

export class AssetDto {
  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ example: 'image/png' })
  declaredMimeType!: string;

  @ApiProperty({ example: null, nullable: true })
  detectedMimeType!: string | null;

  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  originalFileName!: string;

  @ApiProperty()
  sizeBytes!: number;

  @ApiProperty({ enum: ['quarantined', 'processing', 'ready', 'rejected'] })
  status!: string;
}

export class AssetDownloadDto {
  @ApiProperty({ example: 300 })
  expiresInSeconds!: number;

  @ApiProperty({ format: 'uri' })
  url!: string;
}

export class SetAssetReferenceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('7')
  assetId!: string;
}

export class AssetReferenceDto {
  @ApiProperty({ format: 'uuid' })
  assetId!: string;

  @ApiProperty()
  kind!: string;
}
