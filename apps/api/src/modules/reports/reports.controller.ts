import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { OpsRole } from '@wms/types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('stock-by-client')
  @Roles(
    OpsRole.ADMIN,
    OpsRole.SUPERVISOR,
    OpsRole.BILLING,
    OpsRole.READONLY,
  )
  stockByClient() {
    return this.reportsService.stockByClient();
  }

  @Get('order-sla')
  @Roles(
    OpsRole.ADMIN,
    OpsRole.SUPERVISOR,
    OpsRole.WAREHOUSE_OPS,
    OpsRole.READONLY,
  )
  orderSla() {
    return this.reportsService.orderSla();
  }

  @Get('aging-inventory')
  @Roles(
    OpsRole.ADMIN,
    OpsRole.SUPERVISOR,
    OpsRole.WAREHOUSE_OPS,
    OpsRole.READONLY,
  )
  agingInventory() {
    return this.reportsService.agingInventory();
  }

  @Get('ledger')
  @Roles(
    OpsRole.ADMIN,
    OpsRole.SUPERVISOR,
    OpsRole.WAREHOUSE_OPS,
    OpsRole.READONLY,
  )
  ledger(
    @Query('clientId') clientId?: string,
    @Query('itemId') itemId?: string,
    @Query('lotId') lotId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.reportsService.ledger({
      clientId,
      itemId,
      lotId,
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 50, 200),
    });
  }
}
