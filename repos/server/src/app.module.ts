import { Module } from '@nestjs/common';
import { ConfigurationModule } from './config/configuration.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { PlatformModule } from './platform/platform.module.js';

@Module({
  imports: [ConfigurationModule, DatabaseModule, PlatformModule, HealthModule],
})
export class AppModule {}
