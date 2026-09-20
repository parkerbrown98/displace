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
import {
  InviteRoleAuthorizationGuard,
  PlaceContextGuard,
} from './place-context.guard.js';
import {
  AcceptInviteDto,
  AssignRoleDto,
  BanDto,
  BanPageDto,
  CreateBanDto,
  CreateInviteDto,
  CreatePlaceDto,
  CreateRoleDto,
  CursorQueryDto,
  InviteDto,
  InvitePageDto,
  JoinPlaceDto,
  JoinPlaceResultDto,
  MemberDto,
  MemberPageDto,
  MemberQueryDto,
  PlaceDto,
  PlacePageDto,
  RoleDto,
  RolePageDto,
  TransferOwnershipDto,
  UpdatePlaceDto,
  UpdatePlaceSettingsDto,
  UpdateRoleDto,
} from './places.dto.js';
import { PlacesService } from './places.service.js';

const UUID_V7_PIPE = new ParseUUIDPipe({ version: '7' });

@ApiTags('Places')
@Controller({ path: 'places', version: '1' })
export class PlacesController {
  constructor(private readonly places: PlacesService) {}

  @Get()
  @ApiOkResponse({ type: PlacePageDto })
  discover(@Query() query: CursorQueryDto) {
    return this.places.discover(query);
  }

  @Post()
  @UseGuards(AuthenticatedGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: PlaceDto })
  create(@CurrentUser() user: AuthenticatedUser, @Body() input: CreatePlaceDto) {
    return this.places.create(user.id, input);
  }

  @Get(':placeId')
  @UseGuards(PlaceContextGuard)
  @ApiOkResponse({ type: PlaceDto })
  get(
    @Param('placeId') placeId: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.places.get(placeId, user?.id);
  }

  @Patch(':placeId')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('place.manage')
  @ApiBearerAuth()
  @ApiOkResponse({ type: PlaceDto })
  update(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: UpdatePlaceDto,
  ) {
    return this.places.update(place.id, user.id, input);
  }

  @Patch(':placeId/settings')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('place.manage')
  @ApiBearerAuth()
  @ApiOkResponse({ type: PlaceDto })
  updateSettings(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: UpdatePlaceSettingsDto,
  ) {
    return this.places.updateSettings(place.id, user.id, input.settings);
  }

  @Delete(':placeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('place.manage')
  @ApiBearerAuth()
  @ApiNoContentResponse()
  archive(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.places.archive(place.id, user.id);
  }

  @Post(':placeId/join')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthenticatedGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: JoinPlaceResultDto })
  join(
    @Param('placeId') placeId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: JoinPlaceDto,
  ) {
    return this.places.join(placeId, user.id, input.inviteToken);
  }

  @Post(':placeId/invites/accept')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthenticatedGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: JoinPlaceResultDto })
  acceptInvite(
    @Param('placeId') placeId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: AcceptInviteDto,
  ) {
    return this.places.join(placeId, user.id, input.token);
  }

  @Delete(':placeId/members/me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard, PlaceContextGuard)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  leave(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.places.leave(place.id, user.id);
  }

  @Get(':placeId/members')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MemberPageDto })
  listMembers(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MemberQueryDto,
  ) {
    return this.places.listMembers(place.id, user.id, query);
  }

  @Get(':placeId/members/:memberId')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MemberDto })
  getMember(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Param('memberId', UUID_V7_PIPE) memberId: string,
  ) {
    return this.places.getMember(place.id, memberId, user.id);
  }

  @Post(':placeId/members/:memberId/approve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('member.manage')
  @ApiBearerAuth()
  @ApiOkResponse({ type: MemberDto })
  approve(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Param('memberId', UUID_V7_PIPE) memberId: string,
  ) {
    return this.places.approve(place.id, memberId, user.id);
  }

  @Delete(':placeId/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('member.manage')
  @ApiBearerAuth()
  @ApiNoContentResponse()
  removeMember(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Param('memberId', UUID_V7_PIPE) memberId: string,
  ) {
    return this.places.removeMember(place.id, memberId, user.id);
  }

  @Post(':placeId/ownership')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('place.manage')
  @ApiBearerAuth()
  @ApiNoContentResponse()
  transferOwnership(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: TransferOwnershipDto,
  ) {
    return this.places.transferOwnership(place.id, user.id, input.userId);
  }

  @Post(':placeId/invites')
  @UseGuards(
    AuthenticatedGuard,
    PlaceContextGuard,
    AuthorizationGuard,
    InviteRoleAuthorizationGuard,
  )
  @RequirePermissions('member.manage')
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: InviteDto })
  createInvite(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateInviteDto,
  ) {
    return this.places.createInvite(place.id, user.id, input);
  }

  @Get(':placeId/invites')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('member.manage')
  @ApiBearerAuth()
  @ApiOkResponse({ type: InvitePageDto })
  listInvites(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CursorQueryDto,
  ) {
    return this.places.listInvites(place.id, user.id, query);
  }

  @Delete(':placeId/invites/:inviteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('member.manage')
  @ApiBearerAuth()
  @ApiNoContentResponse()
  revokeInvite(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Param('inviteId', UUID_V7_PIPE) inviteId: string,
  ) {
    return this.places.revokeInvite(place.id, inviteId, user.id);
  }

  @Post(':placeId/bans')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('moderation.manage')
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: BanDto })
  createBan(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateBanDto,
  ) {
    return this.places.createBan(place.id, user.id, input);
  }

  @Get(':placeId/bans')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('moderation.manage')
  @ApiBearerAuth()
  @ApiOkResponse({ type: BanPageDto })
  listBans(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CursorQueryDto,
  ) {
    return this.places.listBans(place.id, user.id, query);
  }

  @Delete(':placeId/bans/:banId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('moderation.manage')
  @ApiBearerAuth()
  @ApiNoContentResponse()
  revokeBan(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Param('banId', UUID_V7_PIPE) banId: string,
  ) {
    return this.places.revokeBan(place.id, banId, user.id);
  }

  @Get(':placeId/roles')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: RolePageDto })
  listRoles(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CursorQueryDto,
  ) {
    return this.places.listRoles(place.id, user.id, query);
  }

  @Post(':placeId/roles')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('role.manage')
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: RoleDto })
  createRole(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateRoleDto,
  ) {
    return this.places.createRole(place.id, user.id, input);
  }

  @Patch(':placeId/roles/:roleId')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('role.manage')
  @ApiBearerAuth()
  @ApiOkResponse({ type: RoleDto })
  updateRole(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Param('roleId', UUID_V7_PIPE) roleId: string,
    @Body() input: UpdateRoleDto,
  ) {
    return this.places.updateRole(place.id, roleId, user.id, input);
  }

  @Delete(':placeId/roles/:roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('role.manage')
  @ApiBearerAuth()
  @ApiNoContentResponse()
  deleteRole(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Param('roleId', UUID_V7_PIPE) roleId: string,
  ) {
    return this.places.deleteRole(place.id, roleId, user.id);
  }

  @Post(':placeId/members/:memberId/roles')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('role.manage')
  @ApiBearerAuth()
  @ApiOkResponse({ type: MemberDto })
  assignRole(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Param('memberId', UUID_V7_PIPE) memberId: string,
    @Body() input: AssignRoleDto,
  ) {
    return this.places.assignRole(place.id, memberId, input.roleId, user.id);
  }

  @Delete(':placeId/members/:memberId/roles/:roleId')
  @UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
  @RequirePermissions('role.manage')
  @ApiBearerAuth()
  @ApiOkResponse({ type: MemberDto })
  removeRole(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Param('memberId', UUID_V7_PIPE) memberId: string,
    @Param('roleId', UUID_V7_PIPE) roleId: string,
  ) {
    return this.places.removeRole(place.id, memberId, roleId, user.id);
  }
}