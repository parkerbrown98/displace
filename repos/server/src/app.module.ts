import { Module } from '@nestjs/common';
import { AssetsModule } from './assets/assets.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ConfigurationModule } from './config/configuration.module.js';
import { DatabaseModule } from './database/database.module.js';
import { ForumsModule } from './forums/forums.module.js';
import { HealthModule } from './health/health.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { PlacesModule } from './places/places.module.js';
import { PlatformModule } from './platform/platform.module.js';
import { SearchModule } from './search/search.module.js';

@Module({
  imports: [
    ConfigurationModule,
    DatabaseModule,
    PlatformModule,
    AuthModule,
    PlacesModule,
    AssetsModule,
    ForumsModule,
    JobsModule,
    SearchModule,
    HealthModule,
  ],
})
export class AppModule {}
