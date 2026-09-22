import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedGuard } from '../auth/authentication.guard.js';
import type { AuthorizedPlace, AuthenticatedUser } from '../platform/authorization/authorization-context.js';
import { CurrentPlace } from '../platform/authorization/current-place.decorator.js';
import { CurrentUser } from '../platform/authorization/current-user.decorator.js';
import { PlaceContextGuard } from '../places/place-context.guard.js';
import { ChatService } from './chat.service.js';
import { ChatCursorQueryDto, CreateChatChannelDto, CreateChatMessageDto, MarkChatReadDto, UpdateChatChannelDto, UpdateChatMessageDto } from './chat.dto.js';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller({ path: 'places/:placeId/chat', version: '1' })
@UseGuards(AuthenticatedGuard, PlaceContextGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('channels')
  @ApiOkResponse()
  listChannels(@CurrentPlace() place: AuthorizedPlace, @CurrentUser() user: AuthenticatedUser) {
    return this.chat.listChannels(place.id, user.id);
  }

  @Post('channels')
  @ApiCreatedResponse()
  createChannel(@CurrentPlace() place: AuthorizedPlace, @CurrentUser() user: AuthenticatedUser, @Body() input: CreateChatChannelDto) {
    return this.chat.createChannel(place.id, user.id, input);
  }

  @Patch('channels/:channelId')
  @ApiOkResponse()
  updateChannel(@CurrentPlace() place: AuthorizedPlace, @CurrentUser() user: AuthenticatedUser, @Param('channelId') channelId: string, @Body() input: UpdateChatChannelDto) {
    return this.chat.updateChannel(place.id, channelId, user.id, input);
  }

  @Delete('channels/:channelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  archiveChannel(@CurrentPlace() place: AuthorizedPlace, @CurrentUser() user: AuthenticatedUser, @Param('channelId') channelId: string) {
    return this.chat.archiveChannel(place.id, channelId, user.id);
  }

  @Get('channels/:channelId/messages')
  @ApiOkResponse()
  listMessages(@CurrentPlace() place: AuthorizedPlace, @CurrentUser() user: AuthenticatedUser, @Param('channelId') channelId: string, @Query() query: ChatCursorQueryDto) {
    return this.chat.listMessages(place.id, channelId, user.id, query.cursor, query.limit);
  }

  @Post('channels/:channelId/messages')
  @ApiCreatedResponse()
  sendMessage(@CurrentPlace() place: AuthorizedPlace, @CurrentUser() user: AuthenticatedUser, @Param('channelId') channelId: string, @Body() input: CreateChatMessageDto) {
    return this.chat.sendMessage(place.id, channelId, user.id, input);
  }

  @Put('channels/:channelId/read')
  @ApiOkResponse()
  markRead(@CurrentPlace() place: AuthorizedPlace, @CurrentUser() user: AuthenticatedUser, @Param('channelId') channelId: string, @Body() input: MarkChatReadDto) {
    return this.chat.markRead(place.id, channelId, user.id, input.messageId);
  }

  @Patch('messages/:messageId')
  @ApiOkResponse()
  editMessage(@CurrentPlace() place: AuthorizedPlace, @CurrentUser() user: AuthenticatedUser, @Param('messageId') messageId: string, @Body() input: UpdateChatMessageDto) {
    return this.chat.editMessage(place.id, messageId, user.id, input);
  }

  @Delete('messages/:messageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  deleteMessage(@CurrentPlace() place: AuthorizedPlace, @CurrentUser() user: AuthenticatedUser, @Param('messageId') messageId: string) {
    return this.chat.deleteMessage(place.id, messageId, user.id);
  }
}