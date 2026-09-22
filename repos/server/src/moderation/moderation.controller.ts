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
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedGuard } from '../auth/authentication.guard.js';
import type {
  AuthenticatedUser,
  AuthorizedPlace,
} from '../platform/authorization/authorization-context.js';
import { AuthorizationGuard } from '../platform/authorization/authorization.guard.js';
import { CurrentPlace } from '../platform/authorization/current-place.decorator.js';
import { CurrentUser } from '../platform/authorization/current-user.decorator.js';
import { RequirePermissions } from '../platform/authorization/require-permissions.decorator.js';
import { PlaceContextGuard } from '../places/place-context.guard.js';
import {
  AddModeratorNoteDto,
  AssignReportDto,
  BulkModerationActionDto,
  CreateModerationActionDto,
  CreateReportDto,
  ModerationCursorQueryDto,
  ResolveReportDto,
} from './moderation.dto.js';
import { ModerationService } from './moderation.service.js';

const UUID_V7_PIPE = new ParseUUIDPipe({ version: '7' });

@ApiTags('Moderation')
@ApiBearerAuth()
@Controller({ path: 'places/:placeId', version: '1' })
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Post('reports')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard)
  @ApiCreatedResponse()
  createReport(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateReportDto,
  ) {
    return this.moderation.createReport(place.id, user.id, input);
  }

  @Get('moderation/reports')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('moderation.manage')
  @ApiOkResponse()
  listReports(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ModerationCursorQueryDto,
  ) {
    return this.moderation.listReports(place.id, user.id, query);
  }

  @Get('moderation/reports/:reportId')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('moderation.manage')
  @ApiOkResponse()
  getReport(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Param('reportId', UUID_V7_PIPE) reportId: string,
  ) {
    return this.moderation.getReport(place.id, reportId, user.id);
  }

  @Patch('moderation/reports/:reportId/assignment')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('moderation.manage')
  @ApiOkResponse()
  assignReport(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Param('reportId', UUID_V7_PIPE) reportId: string,
    @Body() input: AssignReportDto,
  ) {
    return this.moderation.assignReport(place.id, reportId, user.id, input);
  }

  @Patch('moderation/reports/:reportId/resolution')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('moderation.manage')
  @ApiOkResponse()
  resolveReport(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Param('reportId', UUID_V7_PIPE) reportId: string,
    @Body() input: ResolveReportDto,
  ) {
    return this.moderation.resolveReport(place.id, reportId, user.id, input);
  }

  @Post('moderation/reports/:reportId/notes')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('moderation.manage')
  @ApiCreatedResponse()
  addNote(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Param('reportId', UUID_V7_PIPE) reportId: string,
    @Body() input: AddModeratorNoteDto,
  ) {
    return this.moderation.addNote(place.id, reportId, user.id, input);
  }

  @Post('moderation/actions')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('moderation.manage')
  @ApiCreatedResponse()
  executeAction(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateModerationActionDto,
  ) {
    return this.moderation.executeAction(place.id, user.id, input);
  }

  @Post('moderation/actions/bulk')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('moderation.manage')
  @ApiCreatedResponse()
  executeBulk(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: BulkModerationActionDto,
  ) {
    return this.moderation.executeBulk(place.id, user.id, input);
  }

  @Delete('moderation/sanctions/:sanctionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('moderation.manage')
  @ApiNoContentResponse()
  revokeSanction(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Param('sanctionId', UUID_V7_PIPE) sanctionId: string,
  ) {
    return this.moderation.revokeSanction(place.id, sanctionId, user.id);
  }
}