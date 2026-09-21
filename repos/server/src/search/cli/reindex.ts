import { NestFactory } from '@nestjs/core';
import { validateEnvironment } from '../../config/environment.js';
import { SearchReindexModule } from '../search-reindex.module.js';
import { SearchService } from '../search.service.js';

validateEnvironment(process.env);
const application = await NestFactory.createApplicationContext(SearchReindexModule);

try {
  await application.get(SearchService).reindex();
} finally {
  await application.close();
}

console.log('Search index rebuilt.');