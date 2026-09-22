import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from '../config/environment.js';
import { DatabaseModule } from '../database/database.module.js';
import { PlatformModule } from '../platform/platform.module.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    PlatformModule,
  ],
  providers: [SearchService],
})
export class SearchReindexModule {}