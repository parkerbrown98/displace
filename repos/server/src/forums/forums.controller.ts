import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedGuard } from '../auth/authentication.guard.js';
import type { AuthenticatedUser, AuthorizedPlace } from '../platform/authorization/authorization-context.js';
import { AuthorizationGuard } from '../platform/authorization/authorization.guard.js';
import { CurrentPlace } from '../platform/authorization/current-place.decorator.js';
import { CurrentUser } from '../platform/authorization/current-user.decorator.js';
import { RequirePermissions } from '../platform/authorization/require-permissions.decorator.js';
import { IdempotencyKey } from '../platform/http/idempotency-key.decorator.js';
import { PlaceContextGuard } from '../places/place-context.guard.js';
import {
  CreateForumDto,
  CreateForumGroupDto,
  CreateForumTagDto,
  CreateTopicDto,
  EditPostDto,
  ForumCursorQueryDto,
  ForumDto,
  ForumGroupDto,
  ForumNavigationDto,
  ForumTagDto,
  MarkTopicReadDto,
  PostDto,
  PostPageDto,
  PostRevisionDto,
  ReactionDto,
  RichTextDocumentDto,
  SavedPostPageDto,
  SavedTopicPageDto,
  TopicDto,
  TopicPageDto,
  TopicQueryDto,
  UpdateForumDto,
  UpdateForumGroupDto,
  UpdateTopicDto,
} from './forums.dto.js';
import { ForumsService } from './forums.service.js';

const UUID_V7_PIPE = new ParseUUIDPipe({ version: '7' });

@ApiTags('Forums')
@Controller({ path: 'places/:placeId', version: '1' })
export class ForumsController {
  constructor(private readonly service: ForumsService) {}

  @Get('forums')
  @UseGuards(PlaceContextGuard)
  @ApiOkResponse({ type: ForumNavigationDto })
  navigation(
    @Param('placeId') placeId: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.service.navigation(placeId, user?.id);
  }

  @Post('forum-groups')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('forum.manage')
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: ForumGroupDto })
  createGroup(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateForumGroupDto,
  ) {
    return this.service.createGroup(place.id, user.id, input);
  }

  @Patch('forum-groups/:groupId')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('forum.manage')
  @ApiBearerAuth()
  @ApiOkResponse({ type: ForumGroupDto })
  updateGroup(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', UUID_V7_PIPE) groupId: string,
    @Body() input: UpdateForumGroupDto,
  ) {
    return this.service.updateGroup(place.id, groupId, user.id, input);
  }

  @Delete('forum-groups/:groupId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('forum.manage')
  @ApiBearerAuth()
  @ApiNoContentResponse()
  deleteGroup(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId', UUID_V7_PIPE) groupId: string,
  ) {
    return this.service.deleteGroup(place.id, groupId, user.id);
  }

  @Post('forums')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('forum.manage')
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: ForumDto })
  createForum(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateForumDto,
  ) {
    return this.service.createForum(place.id, user.id, input);
  }

  @Patch('forums/:forumId')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('forum.manage')
  @ApiBearerAuth()
  @ApiOkResponse({ type: ForumDto })
  updateForum(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Param('forumId', UUID_V7_PIPE) forumId: string,
    @Body() input: UpdateForumDto,
  ) {
    return this.service.updateForum(place.id, forumId, user.id, input);
  }

  @Delete('forums/:forumId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('forum.manage')
  @ApiBearerAuth()
  @ApiNoContentResponse()
  archiveForum(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Param('forumId', UUID_V7_PIPE) forumId: string,
  ) {
    return this.service.archiveForum(place.id, forumId, user.id);
  }

  @Post('forum-tags')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('forum.manage')
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: ForumTagDto })
  createTag(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateForumTagDto,
  ) {
    return this.service.createTag(place.id, user.id, input);
  }

  @Delete('forum-tags/:tagId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('forum.manage')
  @ApiBearerAuth()
  @ApiNoContentResponse()
  deleteTag(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Param('tagId', UUID_V7_PIPE) tagId: string,
  ) {
    return this.service.deleteTag(place.id, tagId, user.id);
  }

  @Get('topics')
  @UseGuards(PlaceContextGuard)
  @ApiOkResponse({ type: TopicPageDto })
  listTopics(
    @Param('placeId') placeId: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: TopicQueryDto,
  ) {
    return this.service.listTopics(placeId, user?.id, query);
  }

  @Post('forums/:forumId/topics')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('topic.create')
  @ApiBearerAuth()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiCreatedResponse({ type: TopicDto })
  createTopic(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Param('forumId', UUID_V7_PIPE) forumId: string,
    @Body() input: CreateTopicDto,
    @IdempotencyKey() idempotencyKey: string,
  ) {
    return this.service.createTopic(place.id, forumId, user.id, input, idempotencyKey);
  }

  @Get('topics/:topicId')
  @UseGuards(PlaceContextGuard)
  @ApiOkResponse({ type: TopicDto })
  getTopic(
    @Param('placeId') placeId: string,
    @Param('topicId', UUID_V7_PIPE) topicId: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.service.getTopic(placeId, topicId, user?.id);
  }

  @Patch('topics/:topicId')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: TopicDto })
  updateTopic(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Param('topicId', UUID_V7_PIPE) topicId: string,
    @Body() input: UpdateTopicDto,
  ) {
    return this.service.updateTopic(place.id, topicId, user.id, input);
  }

  @Delete('topics/:topicId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard, PlaceContextGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  deleteTopic(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Param('topicId', UUID_V7_PIPE) topicId: string,
  ) {
    return this.service.deleteTopic(place.id, topicId, user.id);
  }

  @Get('topics/:topicId/posts')
  @UseGuards(PlaceContextGuard)
  @ApiOkResponse({ type: PostPageDto })
  listPosts(
    @Param('placeId') placeId: string,
    @Param('topicId', UUID_V7_PIPE) topicId: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: ForumCursorQueryDto,
  ) {
    return this.service.listPosts(placeId, topicId, user?.id, query);
  }

  @Post('topics/:topicId/posts')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('post.create')
  @ApiBearerAuth()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiCreatedResponse({ type: PostDto })
  reply(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Param('topicId', UUID_V7_PIPE) topicId: string,
    @Body() input: RichTextDocumentDto,
    @IdempotencyKey() idempotencyKey: string,
  ) {
    return this.service.reply(place.id, topicId, user.id, input.document, idempotencyKey);
  }

  @Patch('posts/:postId')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: PostDto })
  editPost(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId', UUID_V7_PIPE) postId: string,
    @Body() input: EditPostDto,
  ) {
    return this.service.editPost(place.id, postId, user.id, input);
  }

  @Delete('posts/:postId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard, PlaceContextGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  deletePost(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId', UUID_V7_PIPE) postId: string,
  ) {
    return this.service.deletePost(place.id, postId, user.id);
  }

  @Get('posts/:postId/revisions')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('forum.manage')
  @ApiBearerAuth()
  @ApiOkResponse({ isArray: true, type: PostRevisionDto })
  revisions(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId', UUID_V7_PIPE) postId: string,
  ) {
    return this.service.revisions(place.id, postId, user.id);
  }

  @Post('topics/:topicId/lock')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('forum.manage')
  @ApiBearerAuth()
  @ApiOkResponse({ type: TopicDto })
  lock(@CurrentPlace() place: AuthorizedPlace, @CurrentUser() user: AuthenticatedUser, @Param('topicId', UUID_V7_PIPE) topicId: string) {
    return this.service.moderateTopic(place.id, topicId, user.id, { status: 'locked' });
  }

  @Delete('topics/:topicId/lock')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('forum.manage')
  @ApiBearerAuth()
  @ApiOkResponse({ type: TopicDto })
  unlock(@CurrentPlace() place: AuthorizedPlace, @CurrentUser() user: AuthenticatedUser, @Param('topicId', UUID_V7_PIPE) topicId: string) {
    return this.service.moderateTopic(place.id, topicId, user.id, { status: 'open' });
  }

  @Post('topics/:topicId/pin')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('forum.manage')
  @ApiBearerAuth()
  @ApiOkResponse({ type: TopicDto })
  pin(@CurrentPlace() place: AuthorizedPlace, @CurrentUser() user: AuthenticatedUser, @Param('topicId', UUID_V7_PIPE) topicId: string) {
    return this.service.moderateTopic(place.id, topicId, user.id, { isPinned: true });
  }

  @Delete('topics/:topicId/pin')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('forum.manage')
  @ApiBearerAuth()
  @ApiOkResponse({ type: TopicDto })
  unpin(@CurrentPlace() place: AuthorizedPlace, @CurrentUser() user: AuthenticatedUser, @Param('topicId', UUID_V7_PIPE) topicId: string) {
    return this.service.moderateTopic(place.id, topicId, user.id, { isPinned: false });
  }

  @Post('posts/:postId/reactions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard, PlaceContextGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  react(@CurrentPlace() place: AuthorizedPlace, @CurrentUser() user: AuthenticatedUser, @Param('postId', UUID_V7_PIPE) postId: string, @Body() input: ReactionDto) {
    return this.service.setReaction(place.id, postId, user.id, input.reaction, true);
  }

  @Delete('posts/:postId/reactions/:reaction')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard, PlaceContextGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  unreact(@CurrentPlace() place: AuthorizedPlace, @CurrentUser() user: AuthenticatedUser, @Param('postId', UUID_V7_PIPE) postId: string, @Param('reaction') reaction: string) {
    return this.service.setReaction(place.id, postId, user.id, reaction, false);
  }

  @Post('topics/:topicId/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard, PlaceContextGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  follow(@CurrentPlace() place: AuthorizedPlace, @CurrentUser() user: AuthenticatedUser, @Param('topicId', UUID_V7_PIPE) topicId: string) {
    return this.service.setFollow(place.id, topicId, user.id, true);
  }

  @Delete('topics/:topicId/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard, PlaceContextGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  unfollow(@CurrentPlace() place: AuthorizedPlace, @CurrentUser() user: AuthenticatedUser, @Param('topicId', UUID_V7_PIPE) topicId: string) {
    return this.service.setFollow(place.id, topicId, user.id, false);
  }

  @Post('topics/:topicId/save')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard, PlaceContextGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  saveTopic(@CurrentPlace() place: AuthorizedPlace, @CurrentUser() user: AuthenticatedUser, @Param('topicId', UUID_V7_PIPE) topicId: string) {
    return this.service.setTopicSaved(place.id, topicId, user.id, true);
  }

  @Delete('topics/:topicId/save')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard, PlaceContextGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  unsaveTopic(@CurrentPlace() place: AuthorizedPlace, @CurrentUser() user: AuthenticatedUser, @Param('topicId', UUID_V7_PIPE) topicId: string) {
    return this.service.setTopicSaved(place.id, topicId, user.id, false);
  }

  @Post('posts/:postId/save')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard, PlaceContextGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  savePost(@CurrentPlace() place: AuthorizedPlace, @CurrentUser() user: AuthenticatedUser, @Param('postId', UUID_V7_PIPE) postId: string) {
    return this.service.setPostSaved(place.id, postId, user.id, true);
  }

  @Delete('posts/:postId/save')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard, PlaceContextGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  unsavePost(@CurrentPlace() place: AuthorizedPlace, @CurrentUser() user: AuthenticatedUser, @Param('postId', UUID_V7_PIPE) postId: string) {
    return this.service.setPostSaved(place.id, postId, user.id, false);
  }

  @Put('topics/:topicId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard, PlaceContextGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  markRead(@CurrentPlace() place: AuthorizedPlace, @CurrentUser() user: AuthenticatedUser, @Param('topicId', UUID_V7_PIPE) topicId: string, @Body() input: MarkTopicReadDto) {
    return this.service.markRead(place.id, topicId, user.id, input);
  }

  @Delete('topics/:topicId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard, PlaceContextGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  markUnread(@CurrentPlace() place: AuthorizedPlace, @CurrentUser() user: AuthenticatedUser, @Param('topicId', UUID_V7_PIPE) topicId: string) {
    return this.service.markUnread(place.id, topicId, user.id);
  }
}

@ApiTags('Forums')
@Controller({ path: 'saved', version: '1' })
export class SavedForumsController {
  constructor(private readonly service: ForumsService) {}

  @Get('topics')
  @UseGuards(AuthenticatedGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: SavedTopicPageDto })
  listTopics(@CurrentUser() user: AuthenticatedUser, @Query() query: ForumCursorQueryDto) {
    return this.service.listSavedTopics(user.id, query);
  }

  @Get('posts')
  @UseGuards(AuthenticatedGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: SavedPostPageDto })
  listPosts(@CurrentUser() user: AuthenticatedUser, @Query() query: ForumCursorQueryDto) {
    return this.service.listSavedPosts(user.id, query);
  }
}