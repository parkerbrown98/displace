import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PublicProfileDto } from './auth.dto.js';
import { AuthService } from './auth.service.js';

@ApiTags('Profiles')
@Controller({ path: 'profiles', version: '1' })
export class ProfilesController {
  constructor(private readonly authService: AuthService) {}

  @Get(':handle')
  @ApiOkResponse({ type: PublicProfileDto })
  getProfile(@Param('handle') handle: string): Promise<PublicProfileDto> {
    return this.authService.getPublicProfile(handle);
  }
}