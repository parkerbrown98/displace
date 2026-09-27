import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ExpensiveOperation } from '../platform/http/rate-limit.guard.js';
import { SearchPageDto, SearchQueryDto } from './search.dto.js';
import { SearchService } from './search.service.js';

@ApiTags('Search')
@Controller({ path: 'search', version: '1' })
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @ExpensiveOperation()
  @ApiOkResponse({ type: SearchPageDto })
  searchContent(@Query() query: SearchQueryDto) {
    return this.search.search(query);
  }
}