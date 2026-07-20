import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TempClass } from '@wms/types';
import { PackConfigDto } from './create-item.dto';

export class UpdateItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  uom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PackConfigDto)
  packConfig?: PackConfigDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  lotTracked?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  serialTracked?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  shelfLifeDays?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  minShipShelfPct?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  hazmatClass?: string | null;

  @ApiPropertyOptional({ enum: TempClass })
  @IsOptional()
  @IsEnum(TempClass)
  tempClass?: TempClass;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  velocityClass?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
