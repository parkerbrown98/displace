import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CLOCK } from '../platform/clock/clock.js';
import type { Clock } from '../platform/clock/clock.js';
import { DEPENDENCY_PROBE } from './dependency-probe.js';
import type { DependencyProbe } from './dependency-probe.js';
import type {
  DependencyStatusDto,
  LivenessDto,
  ReadinessDto,
} from './health.dto.js';

@Injectable()
export class HealthService {
  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(DEPENDENCY_PROBE) private readonly probe: DependencyProbe,
  ) {}

  getLiveness(): LivenessDto {
    return { status: 'ok', timestamp: this.clock.now().toISOString() };
  }

  async getReadiness(): Promise<ReadinessDto> {
    const checks = {
      postgres: () => this.probe.checkPostgres(),
      redis: () => this.probe.checkRedis(),
      objectStorage: () => this.probe.checkObjectStorage(),
      search: () => this.probe.checkSearch(),
      voice: () => this.probe.checkVoice(),
    };
    const entries = await Promise.all(
      Object.entries(checks).map(
        async ([name, check]) => [name, await this.runCheck(check)] as const,
      ),
    );
    const dependencies = Object.fromEntries(entries) as Record<
      string,
      DependencyStatusDto
    >;

    if (Object.values(dependencies).some(({ status }) => status === 'down')) {
      throw new ServiceUnavailableException({
        message: 'One or more required dependencies are unavailable.',
        readiness: 'not_ready',
        dependencies,
      });
    }

    return {
      status: 'ready',
      timestamp: this.clock.now().toISOString(),
      dependencies,
    };
  }

  private async runCheck(
    check: () => Promise<void>,
  ): Promise<DependencyStatusDto> {
    const startedAt = performance.now();
    try {
      await check();
      return {
        status: 'up',
        latencyMs: Math.round(performance.now() - startedAt),
      };
    } catch {
      return {
        status: 'down',
        latencyMs: Math.round(performance.now() - startedAt),
      };
    }
  }
}
