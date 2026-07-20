import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ClientStatus } from '@wms/types';

export class UpdateClientStatusDto {
  @ApiProperty({ enum: ClientStatus })
  @IsEnum(ClientStatus)
  status!: ClientStatus;
}
