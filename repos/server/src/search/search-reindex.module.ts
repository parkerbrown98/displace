import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../config/configuration.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { PlatformModule } from '../platform/platform.module.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [ConfigurationModule, DatabaseModule, PlatformModule],
  providers: [SearchService],
})
export class SearchReindexModule {}