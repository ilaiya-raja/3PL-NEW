import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreateLocationDto } from './create-location.dto';

export class BulkLocationsDto {
  @ApiProperty({ type: [CreateLocationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => CreateLocationDto)
  locations!: CreateLocationDto[];
}
