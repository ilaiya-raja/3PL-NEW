import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ZoneType, TempClass } from '@wms/types';

export class CreateZoneDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ enum: ZoneType })
  @IsEnum(ZoneType)
  type!: ZoneType;

  @ApiPropertyOptional({ enum: TempClass, default: TempClass.AMBIENT })
  @IsOptional()
  @IsEnum(TempClass)
  tempClass?: TempClass;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  hazmatAllowed?: boolean;
}
