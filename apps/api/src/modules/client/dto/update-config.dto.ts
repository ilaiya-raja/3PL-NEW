import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { AllocationStrategy } from '@wms/types';

export class UpdateClientConfigDto {
  @ApiPropertyOptional({ enum: AllocationStrategy })
  @IsOptional()
  @IsEnum(AllocationStrategy)
  allocationStrategy?: AllocationStrategy;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  adjustmentAutoApproveThreshold?: number;
}
