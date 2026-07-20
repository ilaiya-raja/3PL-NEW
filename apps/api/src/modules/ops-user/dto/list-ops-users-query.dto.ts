import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { OpsRole } from '@wms/types';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListOpsUsersQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: OpsRole })
  @IsOptional()
  @IsEnum(OpsRole)
  role?: OpsRole;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  active?: boolean;
}
