import { Controller, Get, HttpStatus, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OpsRole } from '@wms/types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @Roles(
    OpsRole.ADMIN,
    OpsRole.SUPERVISOR,
    OpsRole.WAREHOUSE_OPS,
    OpsRole.BILLING,
    OpsRole.READONLY,
  )
  @ApiOperation({ summary: 'Get ops dashboard KPI stats' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Dashboard stats retrieved' })
  getOpsStats() {
    return this.dashboardService.getOpsStats();
  }
}
