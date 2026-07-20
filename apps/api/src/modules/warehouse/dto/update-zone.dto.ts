import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ZoneType, TempClass } from '@wms/types';

export class UpdateZoneDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ enum: ZoneType })
  @IsOptional()
  @IsEnum(ZoneType)
  type?: ZoneType;

  @ApiPropertyOptional({ enum: TempClass })
  @IsOptional()
  @IsEnum(TempClass)
  tempClass?: TempClass;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hazmatAllowed?: boolean;
}
