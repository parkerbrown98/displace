import { Module } from '@nestjs/common';
import { DEPENDENCY_PROBE } from './dependency-probe.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';
import { SystemDependencyProbe } from './system-dependency-probe.js';

@Module({
  controllers: [HealthController],
  providers: [
    HealthService,
    SystemDependencyProbe,
    { provide: DEPENDENCY_PROBE, useExisting: SystemDependencyProbe },
  ],
})
export class HealthModule {}
