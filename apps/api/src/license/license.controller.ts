import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OpsRole, type LicenseStatus } from '@wms/types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipLicense } from '../common/decorators/skip-license.decorator';
import type { RequestUser } from '../common/types/request.types';
import { ActivateLicenseDto } from './dto/activate-license.dto';
import { LicenseService } from './license.service';

@ApiTags('License')
@ApiBearerAuth()
@SkipLicense()
@Controller('license')
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Get('status')
  @Roles(OpsRole.ADMIN, OpsRole.SUPERVISOR, OpsRole.WAREHOUSE_OPS, OpsRole.BILLING, OpsRole.READONLY)
  @ApiOperation({ summary: 'Get current license status and usage' })
  @ApiResponse({ status: 200, description: 'License status' })
  async getStatus(): Promise<LicenseStatus> {
    return this.licenseService.getStatus();
  }

  @Post('activate')
  @Roles(OpsRole.ADMIN)
  @ApiOperation({ summary: 'Activate a new license key (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'License activated' })
  @ApiResponse({ status: 402, description: 'Invalid license key' })
  async activate(
    @Body() dto: ActivateLicenseDto,
    @CurrentUser() user: RequestUser,
  ): Promise<LicenseStatus> {
    return this.licenseService.activate(dto.licenseKey, user.sub);
  }
}
