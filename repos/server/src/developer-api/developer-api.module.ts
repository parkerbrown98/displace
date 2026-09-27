import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DeveloperApiController } from './developer-api.controller.js';

@Module({
  controllers: [DeveloperApiController],
  imports: [AuthModule],
})
export class DeveloperApiModule {}
