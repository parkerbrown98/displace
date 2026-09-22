import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedGuard } from '../auth/authentication.guard.js';
import { ExternalAuthorization } from '../auth/authentication.guard.js';
import type {
  AuthenticatedUser,
  AuthorizedPlace,
} from '../platform/authorization/authorization-context.js';
import { CurrentPlace } from '../platform/authorization/current-place.decorator.js';
import { CurrentUser } from '../platform/authorization/current-user.decorator.js';
import { PlaceContextGuard } from '../places/place-context.guard.js';
import { CreateVoiceRoomDto, UpdateVoiceRoomDto } from './voice.dto.js';
import { VoiceService } from './voice.service.js';

@ApiTags('Voice')
@ApiBearerAuth()
@Controller({ path: 'places/:placeId/voice', version: '1' })
@UseGuards(AuthenticatedGuard, PlaceContextGuard)
export class VoiceController {
  constructor(private readonly voice: VoiceService) {}

  @Get('rooms')
  @ApiOkResponse()
  listRooms(@CurrentPlace() place: AuthorizedPlace, @CurrentUser() user: AuthenticatedUser) {
    return this.voice.listRooms(place.id, user.id);
  }

  @Get('rooms/:roomId')
  @ApiOkResponse()
  getRoom(@CurrentPlace() place: AuthorizedPlace, @CurrentUser() user: AuthenticatedUser, @Param('roomId') roomId: string) {
    return this.voice.getRoom(place.id, roomId, user.id);
  }

  @Post('rooms')
  @ApiCreatedResponse()
  createRoom(@CurrentPlace() place: AuthorizedPlace, @CurrentUser() user: AuthenticatedUser, @Body() input: CreateVoiceRoomDto) {
    return this.voice.createRoom(place.id, user.id, input);
  }

  @Patch('rooms/:roomId')
  @ApiOkResponse()
  updateRoom(@CurrentPlace() place: AuthorizedPlace, @CurrentUser() user: AuthenticatedUser, @Param('roomId') roomId: string, @Body() input: UpdateVoiceRoomDto) {
    return this.voice.updateRoom(place.id, roomId, user.id, input);
  }

  @Delete('rooms/:roomId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  archiveRoom(@CurrentPlace() place: AuthorizedPlace, @CurrentUser() user: AuthenticatedUser, @Param('roomId') roomId: string) {
    return this.voice.archiveRoom(place.id, roomId, user.id);
  }

  @Post('rooms/:roomId/join-token')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse()
  createJoinToken(@CurrentPlace() place: AuthorizedPlace, @CurrentUser() user: AuthenticatedUser, @Param('roomId') roomId: string) {
    return this.voice.createJoinToken(place.id, roomId, user.id);
  }
}

@ApiTags('Voice')
@Controller({ path: 'voice', version: '1' })
export class VoiceWebhookController {
  constructor(private readonly voice: VoiceService) {}

  @Post('webhook')
  @ExternalAuthorization()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async receive(
    @Req() request: RawBodyRequest<FastifyRequest>,
    @Headers('authorization') authorization?: string,
  ) {
    await this.voice.reconcileWebhook(request.rawBody?.toString('utf8') ?? '', authorization);
  }
}