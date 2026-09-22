import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedGuard } from '../auth/authentication.guard.js';
import type { AuthenticatedUser } from '../platform/authorization/authorization-context.js';
import { CurrentUser } from '../platform/authorization/current-user.decorator.js';
import { NotificationCursorQueryDto } from './notifications.dto.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller({ path: 'notifications', version: '1' })
@UseGuards(AuthenticatedGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOkResponse()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: NotificationCursorQueryDto) {
    return this.notifications.list(user.id, query.cursor, query.limit);
  }

  @Patch(':notificationId/read')
  @ApiOkResponse()
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('notificationId') notificationId: string) {
    return this.notifications.markRead(user.id, notificationId);
  }

  @Delete(':notificationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  dismiss(@CurrentUser() user: AuthenticatedUser, @Param('notificationId') notificationId: string) {
    return this.notifications.dismiss(user.id, notificationId);
  }
}