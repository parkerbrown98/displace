import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProblemDetailsDto } from '../platform/http/problem-details.dto.js';
import { LivenessDto, ReadinessDto } from './health.dto.js';
import { HealthService } from './health.service.js';

@ApiTags('Health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @ApiOkResponse({ type: LivenessDto })
  getLiveness(): LivenessDto {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  @ApiOkResponse({ type: ReadinessDto })
  @ApiServiceUnavailableResponse({ type: ProblemDetailsDto })
  getReadiness(): Promise<ReadinessDto> {
    return this.healthService.getReadiness();
  }
}
