import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MembershipsRepository } from './memberships.repository.js';
import {
  InviteRoleAuthorizationGuard,
  PlaceContextGuard,
} from './place-context.guard.js';
import { PlacesController } from './places.controller.js';
import { PlacesRepository } from './places.repository.js';
import { PlacesService } from './places.service.js';
import { RolesRepository } from './roles.repository.js';

@Module({
  imports: [AuthModule],
  controllers: [PlacesController],
  providers: [
    MembershipsRepository,
    InviteRoleAuthorizationGuard,
    PlaceContextGuard,
    PlacesRepository,
    PlacesService,
    RolesRepository,
  ],
})
export class PlacesModule {}