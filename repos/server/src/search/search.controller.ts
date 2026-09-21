import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SearchQueryDto } from './search.dto.js';
import { SearchService } from './search.service.js';

@ApiTags('Search')
@Controller({ path: 'search', version: '1' })
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @ApiOkResponse()
  searchContent(@Query() query: SearchQueryDto) {
    return this.search.search(query);
  }
}