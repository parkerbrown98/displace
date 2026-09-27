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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

export class SearchHighlightsDto {
  @ApiPropertyOptional()
  text?: string;
  @ApiPropertyOptional()
  title?: string;
}

export class SearchResultDto {
  @ApiProperty({ format: 'date-time' })
  createdAt: string;
  @ApiPropertyOptional({ format: 'uuid' })
  forumId?: string;
  @ApiPropertyOptional({ type: SearchHighlightsDto })
  highlights?: SearchHighlightsDto;
  @ApiProperty({ format: 'uuid' })
  placeId: string;
  @ApiProperty()
  placeSlug: string;
  @ApiPropertyOptional({ format: 'uuid' })
  postId?: string;
  @ApiProperty()
  text: string;
  @ApiProperty()
  title: string;
  @ApiPropertyOptional({ format: 'uuid' })
  topicId?: string;
  @ApiProperty({ enum: SearchTypeDto })
  type: SearchTypeDto;
}

export class SearchPageDto {
  @ApiProperty({ isArray: true, type: SearchResultDto })
  items: SearchResultDto[];
  @ApiPropertyOptional()
  nextCursor?: string;
}