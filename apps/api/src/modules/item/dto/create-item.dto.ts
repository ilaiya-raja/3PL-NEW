import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
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

export class PackConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  unitsPerCase?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  casesPerPallet?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @IsPositive()
  caseWeightKg?: number;

  [key: string]: unknown;
}

export class CreateItemDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  sku!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  description!: string;

  @ApiPropertyOptional({ default: 'EA' })
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

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  lotTracked?: boolean;

  @ApiPropertyOptional({ default: false })
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

  @ApiPropertyOptional({ enum: TempClass, default: TempClass.AMBIENT })
  @IsOptional()
  @IsEnum(TempClass)
  tempClass?: TempClass;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  velocityClass?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
