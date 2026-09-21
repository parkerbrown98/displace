import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
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
  AssetDownloadDto,
  AssetDto,
  AssetReferenceDto,
  CreateUploadIntentDto,
  SetAssetReferenceDto,
  UploadIntentDto,
} from './assets.dto.js';
import { AssetsService } from './assets.service.js';

const UUID_V7_PIPE = new ParseUUIDPipe({ version: '7' });
enum UserImageKind {
  Avatar = 'avatar',
  Banner = 'banner',
}
enum PlaceImageKind {
  Banner = 'banner',
  Icon = 'icon',
}

@ApiTags('Assets')
@ApiBearerAuth()
@Controller({ path: 'places/:placeId/assets', version: '1' })
@UseGuards(AuthenticatedGuard, PlaceContextGuard, AuthorizationGuard)
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Post('upload-intents')
  @RequirePermissions('upload.create')
  @ApiCreatedResponse({ type: UploadIntentDto })
  createUploadIntent(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateUploadIntentDto,
  ) {
    return this.assets.createUploadIntent(place.id, user.id, input);
  }

  @Post('upload-intents/:intentId/complete')
  @RequirePermissions('upload.create')
  @ApiCreatedResponse({ type: AssetDto })
  completeUpload(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Param('intentId', UUID_V7_PIPE) intentId: string,
  ) {
    return this.assets.completeUpload(place.id, user.id, intentId);
  }

  @Put('profile-images/:kind')
  @RequirePermissions('upload.create')
  @ApiOkResponse({ type: AssetReferenceDto })
  setProfileImage(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Param('kind', new ParseEnumPipe(UserImageKind)) kind: UserImageKind,
    @Body() input: SetAssetReferenceDto,
  ) {
    return this.assets.setUserImage(place.id, user.id, kind, input.assetId);
  }

  @Put('place-images/:kind')
  @RequirePermissions('place.manage')
  @ApiOkResponse({ type: AssetReferenceDto })
  setPlaceImage(
    @CurrentPlace() place: AuthorizedPlace,
    @Param('kind', new ParseEnumPipe(PlaceImageKind)) kind: PlaceImageKind,
    @Body() input: SetAssetReferenceDto,
  ) {
    return this.assets.setPlaceImage(place.id, kind, input.assetId);
  }

  @Get(':assetId/download')
  @RequirePermissions('upload.read')
  @ApiOkResponse({ type: AssetDownloadDto })
  createDownloadUrl(
    @CurrentPlace() place: AuthorizedPlace,
    @Param('assetId', UUID_V7_PIPE) assetId: string,
  ) {
    return this.assets.createDownloadUrl(place.id, assetId);
  }

  @Get(':assetId')
  @RequirePermissions('upload.read')
  @ApiOkResponse({ type: AssetDto })
  getAsset(
    @CurrentPlace() place: AuthorizedPlace,
    @Param('assetId', UUID_V7_PIPE) assetId: string,
  ) {
    return this.assets.getAsset(place.id, assetId);
  }
}
