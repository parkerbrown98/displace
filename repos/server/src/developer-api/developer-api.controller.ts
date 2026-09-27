import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedGuard } from '../auth/authentication.guard.js';
import type { AuthenticatedUser } from '../platform/authorization/authorization-context.js';
import { CurrentUser } from '../platform/authorization/current-user.decorator.js';
import {
  ApiTokenDto,
  CreateApiTokenDto,
  IssuedApiTokenDto,
  RotateApiTokenDto,
} from './developer-api.dto.js';
import { DeveloperApiService } from './developer-api.service.js';

@ApiTags('Developer API')
@ApiBearerAuth('bearer')
@UseGuards(AuthenticatedGuard)
@Controller({ path: 'developer/tokens', version: '1' })
export class DeveloperApiController {
  constructor(private readonly developerApi: DeveloperApiService) {}

  @Get()
  @ApiOperation({ summary: 'List personal access tokens' })
  @ApiOkResponse({ type: ApiTokenDto, isArray: true })
  list(@CurrentUser() user: AuthenticatedUser): Promise<ApiTokenDto[]> {
    this.requireSession(user);
    return this.developerApi.list(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a personal access token' })
  @ApiCreatedResponse({ type: IssuedApiTokenDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateApiTokenDto,
  ): Promise<IssuedApiTokenDto> {
    this.requireSession(user);
    return this.developerApi.create(user.id, input);
  }

  @Post(':tokenId/rotate')
  @ApiOperation({ summary: 'Rotate a personal access token' })
  @ApiCreatedResponse({ type: IssuedApiTokenDto })
  rotate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tokenId') tokenId: string,
    @Body() input: RotateApiTokenDto,
  ): Promise<IssuedApiTokenDto> {
    this.requireSession(user);
    return this.developerApi.rotate(user.id, tokenId, input.expiresAt);
  }

  @Delete(':tokenId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a personal access token' })
  @ApiNoContentResponse()
  revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tokenId') tokenId: string,
  ): Promise<void> {
    this.requireSession(user);
    return this.developerApi.revoke(user.id, tokenId);
  }

  private requireSession(user: AuthenticatedUser): void {
    if (!user.sessionId) {
      throw new ForbiddenException('Personal access tokens cannot manage API tokens.');
    }
  }
}
