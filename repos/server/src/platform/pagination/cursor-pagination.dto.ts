import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CursorPaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque cursor returned by the previous page.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2_048)
  cursor?: string;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit = 25;
}

export class CursorPageMetaDto {
  @ApiPropertyOptional({ description: 'Opaque cursor for the next page.' })
  nextCursor?: string;

  @ApiProperty()
  hasMore!: boolean;
}

export interface CursorPage<T> {
  data: T[];
  page: CursorPageMetaDto;
}
