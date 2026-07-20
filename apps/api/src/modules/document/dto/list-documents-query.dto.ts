import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { DocumentType } from '@wms/types';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListDocumentsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: DocumentType })
  @IsOptional()
  @IsEnum(DocumentType)
  type?: DocumentType;

  @ApiPropertyOptional({ description: 'ISO date lower bound (inclusive)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date upper bound (inclusive)' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
