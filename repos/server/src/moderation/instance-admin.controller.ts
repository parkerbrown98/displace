import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedGuard } from '../auth/authentication.guard.js';
import type { AuthenticatedUser } from '../platform/authorization/authorization-context.js';
import { CurrentUser } from '../platform/authorization/current-user.decorator.js';
import { InstanceAdminGuard } from './instance-admin.guard.js';
import { InstanceAdminService } from './instance-admin.service.js';
import {
  AccountStatusActionDto,
  UpdateInstanceSettingsDto,
} from './moderation.dto.js';

const UUID_V7_PIPE = new ParseUUIDPipe({ version: '7' });

@ApiTags('Instance administration')
@ApiBearerAuth()
@UseGuards(AuthenticatedGuard, InstanceAdminGuard)
@Controller({ path: 'admin', version: '1' })
export class InstanceAdminController {
  constructor(private readonly admin: InstanceAdminService) {}

  @Get('settings')
  @ApiOkResponse()
  getSettings() {
    return this.admin.getSettings();
  }

  @Patch('settings')
  @ApiOkResponse()
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: UpdateInstanceSettingsDto,
  ) {
    return this.admin.updateSettings(user.id, input);
  }

  @Post('users/:userId/suspend')
  @ApiOkResponse()
  suspendAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', UUID_V7_PIPE) userId: string,
    @Body() input: AccountStatusActionDto,
  ) {
    return this.admin.suspendAccount(user.id, userId, input);
  }

  @Post('users/:userId/restore')
  @ApiOkResponse()
  restoreAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', UUID_V7_PIPE) userId: string,
    @Body() input: AccountStatusActionDto,
  ) {
    return this.admin.restoreAccount(user.id, userId, input);
  }
}