import {
  Body,
  Controller,
  Get,
  Header,
  HttpStatus,
  NotFoundException,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Redirect,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedGuard } from '../auth/authentication.guard.js';
import type { AppEnvironment } from '../config/environment.js';
import type {
  AuthenticatedUser,
  AuthorizedPlace,
} from '../platform/authorization/authorization-context.js';
import { AuthorizationGuard } from '../platform/authorization/authorization.guard.js';
import { CurrentPlace } from '../platform/authorization/current-place.decorator.js';
import { CurrentUser } from '../platform/authorization/current-user.decorator.js';
import { RequirePermissions } from '../platform/authorization/require-permissions.decorator.js';
import { PlaceContextGuard } from '../places/place-context.guard.js';
import { PlacesRepository } from '../places/places.repository.js';
import {
  AssetDownloadDto,
  AssetDto,
  AssetReferenceDto,
  CreateUploadIntentDto,
  CurrentAssetReferenceDto,
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

@ApiTags('Public assets')
@Controller({ path: 'public/places/:placeId/images', version: '1' })
export class PublicPlaceImagesController {
  constructor(
    private readonly assets: AssetsService,
    private readonly places: PlacesRepository,
    private readonly config: ConfigService<AppEnvironment, true>,
  ) {}

  @Get('banner')
  @Header('Cross-Origin-Resource-Policy', 'cross-origin')
  @Redirect(undefined, HttpStatus.TEMPORARY_REDIRECT)
  async getBanner(@Param('placeId', UUID_V7_PIPE) placeId: string) {
    const place = await this.places.findByIdentifier(placeId);
    const configuredSlug = this.config.get('SINGLE_PLACE_SLUG', { infer: true });
    if (
      !place ||
      place.archivedAt ||
      place.visibility !== 'public' ||
      (this.config.get('SINGLE_PLACE_MODE', { infer: true }) &&
        place.slug !== configuredSlug)
    ) {
      throw new NotFoundException('Place banner was not found.');
    }
    const reference = await this.assets.getPlaceImage(place.id, 'banner');
    if (!reference.assetId) {
      throw new NotFoundException('Place banner was not found.');
    }
    const download = await this.assets.createDownloadUrl(
      place.id,
      reference.assetId,
    );
    return { statusCode: HttpStatus.TEMPORARY_REDIRECT, url: download.url };
  }
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

  @Get('profile-images/:kind')
  @RequirePermissions('upload.read')
  @ApiOkResponse({ type: CurrentAssetReferenceDto })
  getProfileImage(
    @CurrentPlace() place: AuthorizedPlace,
    @CurrentUser() user: AuthenticatedUser,
    @Param('kind', new ParseEnumPipe(UserImageKind)) kind: UserImageKind,
  ) {
    return this.assets.getUserImage(place.id, user.id, kind);
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

  @Get('place-images/:kind')
  @RequirePermissions('upload.read')
  @ApiOkResponse({ type: CurrentAssetReferenceDto })
  getPlaceImage(
    @CurrentPlace() place: AuthorizedPlace,
    @Param('kind', new ParseEnumPipe(PlaceImageKind)) kind: PlaceImageKind,
  ) {
    return this.assets.getPlaceImage(place.id, kind);
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
