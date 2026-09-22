import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PlacesModule } from '../places/places.module.js';
import { InstanceAdminController } from './instance-admin.controller.js';
import { InstanceAdminGuard } from './instance-admin.guard.js';
import { InstanceAdminRepository } from './instance-admin.repository.js';
import { InstanceAdminService } from './instance-admin.service.js';
import { ModerationController } from './moderation.controller.js';
import { ModerationPolicy } from './moderation.policy.js';
import { ModerationRepository } from './moderation.repository.js';
import { ModerationService } from './moderation.service.js';

@Module({
  imports: [AuthModule, PlacesModule],
  controllers: [InstanceAdminController, ModerationController],
  providers: [
    InstanceAdminGuard,
    InstanceAdminRepository,
    InstanceAdminService,
    ModerationPolicy,
    ModerationRepository,
    ModerationService,
  ],
  exports: [ModerationRepository],
})
export class ModerationModule {}