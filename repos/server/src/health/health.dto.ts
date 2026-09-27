import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';

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

@ApiExtraModels(DependencyStatusDto)
export class ReadinessDto {
  @ApiProperty({ example: 'ready' })
  status!: 'ready';

  @ApiProperty({ format: 'date-time' })
  timestamp!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { $ref: getSchemaPath(DependencyStatusDto) },
  })
  dependencies!: Record<string, DependencyStatusDto>;
}
