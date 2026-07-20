import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ActivateLicenseDto {
  @ApiProperty({ description: 'RSA-signed JWT license key' })
  @IsString()
  @MinLength(20)
  licenseKey!: string;
}
