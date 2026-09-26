import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsHexColor,
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
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { RichTextDocument } from '../database/schema/forums.js';
import { PLACE_PERMISSIONS, type PlacePermission } from '../places/place-permissions.js';

export enum ForumVisibilityDto {
  Members = 'members',
  Public = 'public',
}

export enum TopicFeedDto {
  Following = 'following',
  Latest = 'latest',
  Popular = 'popular',
}

export enum FeedSortDto {
  Best = 'best',
  Hot = 'hot',
  New = 'new',
  Top = 'top',
}

export enum FeedSourceDto {
  Following = 'following',
  Joined = 'joined',
  Trending = 'trending',
}

export class ForumCursorQueryDto {
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
}

export class CreateForumGroupDto {
  @ApiProperty({ maxLength: 120, minLength: 1 })
  @IsString()
  @Length(1, 120)
  @Matches(/\S/)
  name: string;

  @ApiPropertyOptional({ maxLength: 2_000 })
  @IsString()
  @MaxLength(2_000)
  @IsOptional()
  description = '';

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  position = 0;
}

export class UpdateForumGroupDto {
  @ApiPropertyOptional({ maxLength: 120, minLength: 1 })
  @IsString()
  @Length(1, 120)
  @Matches(/\S/)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ maxLength: 2_000 })
  @IsString()
  @MaxLength(2_000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  position?: number;
}

export class CreateForumDto extends CreateForumGroupDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('7')
  groupId: string;

  @ApiPropertyOptional({ enum: ForumVisibilityDto })
  @IsEnum(ForumVisibilityDto)
  @IsOptional()
  visibility: ForumVisibilityDto = ForumVisibilityDto.Public;

  @ApiPropertyOptional({ enum: PLACE_PERMISSIONS, nullable: true })
  @IsIn(PLACE_PERMISSIONS)
  @IsOptional()
  readPermission?: PlacePermission;

  @ApiPropertyOptional({ enum: PLACE_PERMISSIONS, nullable: true })
  @IsIn(PLACE_PERMISSIONS)
  @IsOptional()
  writePermission?: PlacePermission;
}

export class UpdateForumDto extends UpdateForumGroupDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID('7')
  @IsOptional()
  groupId?: string;

  @ApiPropertyOptional({ enum: ForumVisibilityDto })
  @IsEnum(ForumVisibilityDto)
  @IsOptional()
  visibility?: ForumVisibilityDto;

  @ApiPropertyOptional({ enum: PLACE_PERMISSIONS, nullable: true })
  @IsIn(PLACE_PERMISSIONS)
  @IsOptional()
  readPermission?: PlacePermission | null;

  @ApiPropertyOptional({ enum: PLACE_PERMISSIONS, nullable: true })
  @IsIn(PLACE_PERMISSIONS)
  @IsOptional()
  writePermission?: PlacePermission | null;
}

export class CreateForumTagDto {
  @ApiProperty({ maxLength: 50 })
  @Length(1, 50)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug: string;

  @ApiProperty({ maxLength: 50 })
  @IsString()
  @Length(1, 50)
  @Matches(/\S/)
  name: string;

  @ApiPropertyOptional({ example: '#2563EB' })
  @IsHexColor()
  @IsOptional()
  color?: string;
}

export class RichTextDocumentDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  document: RichTextDocument;
}

export class CreateTopicDto extends RichTextDocumentDto {
  @ApiProperty({ maxLength: 300, minLength: 1 })
  @IsString()
  @Length(1, 300)
  @Matches(/\S/)
  title: string;

  @ApiPropertyOptional({ type: String, isArray: true, maxItems: 10 })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(10)
  @IsUUID('7', { each: true })
  @IsOptional()
  tagIds: string[] = [];
}

export class UpdateTopicDto {
  @ApiPropertyOptional({ maxLength: 300, minLength: 1 })
  @IsString()
  @Length(1, 300)
  @Matches(/\S/)
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ type: String, isArray: true, maxItems: 10 })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(10)
  @IsUUID('7', { each: true })
  @IsOptional()
  tagIds?: string[];
}

export class EditPostDto extends RichTextDocumentDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  expectedVersion: number;
}

export class ReactionDto {
  @ApiProperty({ maxLength: 40, minLength: 1 })
  @Length(1, 40)
  @Matches(/^[a-z0-9_+-]+$/)
  reaction: string;
}

export class TopicQueryDto extends ForumCursorQueryDto {
  @ApiPropertyOptional({ enum: TopicFeedDto, default: TopicFeedDto.Latest })
  @IsEnum(TopicFeedDto)
  @IsOptional()
  feed: TopicFeedDto = TopicFeedDto.Latest;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID('7')
  @IsOptional()
  forumId?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  tag?: string;
}

export class FeedQueryDto extends ForumCursorQueryDto {
  @ApiPropertyOptional({ enum: FeedSortDto, default: FeedSortDto.Best })
  @IsEnum(FeedSortDto)
  @IsOptional()
  sort: FeedSortDto = FeedSortDto.Best;
}

export class MarkTopicReadDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID('7')
  @IsOptional()
  lastReadPostId?: string;
}

export class ForumTagDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  slug: string;
  @ApiProperty()
  name: string;
  @ApiProperty({ nullable: true })
  color: string | null;
}

export class ForumDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  groupId: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  description: string;
  @ApiProperty()
  position: number;
  @ApiProperty({ enum: ForumVisibilityDto })
  visibility: ForumVisibilityDto;
  @ApiProperty({ nullable: true })
  readPermission: string | null;
  @ApiProperty({ nullable: true })
  writePermission: string | null;
}

export class ForumGroupDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  description: string;
  @ApiProperty()
  position: number;
  @ApiProperty({ type: ForumDto, isArray: true })
  forums: ForumDto[];
}

export class ForumNavigationDto {
  @ApiProperty({ type: ForumGroupDto, isArray: true })
  groups: ForumGroupDto[];
  @ApiProperty({ type: ForumTagDto, isArray: true })
  tags: ForumTagDto[];
}

export class PostReactionSummaryDto {
  @ApiProperty()
  count: number;
  @ApiProperty()
  reacted: boolean;
  @ApiProperty()
  reaction: string;
}

export class PostAuthorDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  displayName: string;
  @ApiProperty()
  handle: string;
  @ApiProperty({ format: 'date-time' })
  joinedAt: Date;
}

export class PostDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  topicId: string;
  @ApiProperty()
  authorUserId: string;
  @ApiProperty({ type: PostAuthorDto })
  author: PostAuthorDto;
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  document: RichTextDocument | null;
  @ApiProperty({ nullable: true })
  sanitizedHtml: string | null;
  @ApiProperty({ nullable: true })
  plainText: string | null;
  @ApiProperty()
  version: number;
  @ApiProperty()
  isDeleted: boolean;
  @ApiProperty({ isArray: true, type: PostReactionSummaryDto })
  reactions: PostReactionSummaryDto[];
  @ApiProperty({ format: 'date-time' })
  createdAt: Date;
  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;
}

export class PostRevisionDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  postId: string;
  @ApiProperty()
  editorUserId: string;
  @ApiProperty({ type: 'object', additionalProperties: true })
  document: RichTextDocument;
  @ApiProperty()
  sanitizedHtml: string;
  @ApiProperty()
  plainText: string;
  @ApiProperty()
  version: number;
  @ApiProperty({ format: 'date-time' })
  createdAt: Date;
}

export class TopicDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  forumId: string;
  @ApiProperty()
  authorUserId: string;
  @ApiProperty({ type: PostAuthorDto })
  author: PostAuthorDto;
  @ApiProperty()
  title: string;
  @ApiProperty({ enum: ['open', 'locked'] })
  status: 'open' | 'locked';
  @ApiProperty()
  isPinned: boolean;
  @ApiProperty()
  replyCount: number;
  @ApiProperty()
  viewCount: number;
  @ApiPropertyOptional({
    nullable: true,
    type: 'object',
    properties: {
      alt: { type: 'string' },
      assetId: { type: 'string', format: 'uuid' },
    },
  })
  previewImage: { alt: string; assetId: string } | null;
  @ApiProperty({ type: ForumTagDto, isArray: true })
  tags: ForumTagDto[];
  @ApiProperty({ format: 'date-time' })
  latestPostAt: Date;
  @ApiProperty({ format: 'date-time' })
  createdAt: Date;
}

export class TopicPageDto {
  @ApiProperty({ type: TopicDto, isArray: true })
  items: TopicDto[];
  @ApiPropertyOptional()
  nextCursor?: string;
}

export class FeedPlaceDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  slug: string;
  @ApiProperty()
  name: string;
}

export class FeedForumDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
}

export class FeedItemDto {
  @ApiProperty({ type: TopicDto })
  topic: TopicDto;
  @ApiProperty({ type: FeedPlaceDto })
  place: FeedPlaceDto;
  @ApiProperty({ type: FeedForumDto })
  forum: FeedForumDto;
  @ApiProperty()
  originalPostId: string;
  @ApiProperty()
  excerpt: string;
  @ApiProperty()
  reactionCount: number;
  @ApiProperty()
  viewerHasReacted: boolean;
  @ApiProperty()
  isFollowing: boolean;
  @ApiProperty()
  isSaved: boolean;
  @ApiProperty({ enum: FeedSourceDto, isArray: true })
  sources: FeedSourceDto[];
}

export class FeedPageDto {
  @ApiProperty({ type: FeedItemDto, isArray: true })
  items: FeedItemDto[];
  @ApiPropertyOptional()
  nextCursor?: string;
}

export class PostPageDto {
  @ApiProperty({ type: PostDto, isArray: true })
  items: PostDto[];
  @ApiPropertyOptional()
  nextCursor?: string;
}

export class PostViewerStateDto {
  @ApiProperty()
  postId: string;
  @ApiProperty()
  isSaved: boolean;
  @ApiProperty({ isArray: true, type: String })
  reactions: string[];
}

export class TopicViewerStateDto {
  @ApiProperty()
  isFollowing: boolean;
  @ApiProperty()
  isSaved: boolean;
  @ApiProperty({ isArray: true, type: PostViewerStateDto })
  posts: PostViewerStateDto[];
}

export class SavedTopicDto {
  @ApiProperty()
  placeId: string;
  @ApiProperty()
  placeSlug: string;
  @ApiProperty()
  placeName: string;
  @ApiProperty({ type: TopicDto })
  topic: TopicDto;
  @ApiProperty({ format: 'date-time' })
  savedAt: Date;
}

export class SavedTopicPageDto {
  @ApiProperty({ type: SavedTopicDto, isArray: true })
  items: SavedTopicDto[];
  @ApiPropertyOptional()
  nextCursor?: string;
}

export class SavedPostDto {
  @ApiProperty()
  placeId: string;
  @ApiProperty()
  placeSlug: string;
  @ApiProperty()
  placeName: string;
  @ApiProperty()
  topicTitle: string;
  @ApiProperty({ type: PostDto })
  post: PostDto;
  @ApiProperty({ format: 'date-time' })
  savedAt: Date;
}

export class SavedPostPageDto {
  @ApiProperty({ type: SavedPostDto, isArray: true })
  items: SavedPostDto[];
  @ApiPropertyOptional()
  nextCursor?: string;
}