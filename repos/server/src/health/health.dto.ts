import { ApiProperty } from '@nestjs/swagger';

export class LivenessDto {
  @ApiProperty({ example: 'ok' })
  status!: 'ok';

  @ApiProperty({ format: 'date-time' })
  timestamp!: string;
}

export class DependencyStatusDto {
  @ApiProperty({ enum: ['up', 'down'] })
  status!: 'up' | 'down';

  @ApiProperty({ minimum: 0 })
  latencyMs!: number;
}

export class ReadinessDto {
  @ApiProperty({ example: 'ready' })
  status!: 'ready';

  @ApiProperty({ format: 'date-time' })
  timestamp!: string;

  @ApiProperty({
    additionalProperties: { $ref: '#/components/schemas/DependencyStatusDto' },
  })
  dependencies!: Record<string, DependencyStatusDto>;
}
