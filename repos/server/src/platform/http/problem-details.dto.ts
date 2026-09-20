import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProblemDetailsDto {
  @ApiProperty({ example: 'about:blank' })
  type!: string;

  @ApiProperty({ example: 'Bad Request' })
  title!: string;

  @ApiProperty({ example: 400 })
  status!: number;

  @ApiProperty({ example: 'Request validation failed.' })
  detail!: string;

  @ApiProperty({ example: '/api/v1/example' })
  instance!: string;

  @ApiProperty({ example: '47d3cf58-5e39-43e7-8702-50fd8462bd0f' })
  requestId!: string;

  @ApiPropertyOptional({ type: [String] })
  errors?: string[];
}
