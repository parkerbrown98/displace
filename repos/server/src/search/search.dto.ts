import { Type } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum SearchTypeDto {
  Place = 'place',
  Post = 'post',
  Topic = 'topic',
}

export class SearchQueryDto {
  @ApiPropertyOptional({ maxLength: 200, minLength: 2 })
  @IsString()
  @Length(2, 200)
  q: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  cursor?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID('7')
  @IsOptional()
  placeId?: string;

  @ApiPropertyOptional({ enum: SearchTypeDto })
  @IsEnum(SearchTypeDto)
  @IsOptional()
  type?: SearchTypeDto;

  @ApiPropertyOptional({ default: 25, maximum: 50, minimum: 1 })
  @Type(() => Number)
  @Min(1)
  @Max(50)
  @IsOptional()
  limit = 25;
}