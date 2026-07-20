import { Controller, Get, Param, Post, Body, Query } from '@nestjs/common';
import {
  createReceiptSchema,
  listReceiptsQuerySchema,
  listItemsQuerySchema,
} from '@wms/zod-schemas';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { PortalService } from './portal.service';
import { InboundService } from '../inbound/inbound.service';
import { ItemService } from '../item/item.service';

@Controller('portal')
export class PortalController {
  constructor(
    private readonly portalService: PortalService,
    private readonly inboundService: InboundService,
    private readonly itemService: ItemService,
  ) {}

  @Get('dashboard/stats')
  async dashboardStats(@TenantId() clientId: string) {
    return this.portalService.getDashboardStats(clientId!);
  }

  @Get('analytics')
  async analytics(
    @TenantId() clientId: string,
    @Query('days') days?: string,
  ) {
    return this.portalService.getAnalytics(
      clientId!,
      days ? Number(days) : 30,
    );
  }

  @Get('items')
  async listItems(
    @TenantId() clientId: string,
    @Query(new ZodValidationPipe(listItemsQuerySchema)) query: any,
  ) {
    return this.itemService.listItems(clientId!, query);
  }

  @Get('expiring-lots')
  async expiringLots(@TenantId() clientId: string) {
    return this.portalService.getExpiringLots(clientId!);
  }

  @Get('warehouses')
  async listWarehouses(@TenantId() clientId: string) {
    return this.portalService.listWarehousesForClient(clientId!);
  }

  /** Alias for portal UI that calls /portal/inbound */
  @Get('inbound')
  async listInbound(
    @TenantId() clientId: string,
    @Query(new ZodValidationPipe(listReceiptsQuerySchema)) query: any,
  ) {
    return this.inboundService.listReceipts(
      clientId!,
      { status: query.status, warehouseId: query.warehouseId },
      {
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
      false,
    );
  }

  @Post('inbound')
  async createInbound(
    @TenantId() clientId: string,
    @Body(new ZodValidationPipe(createReceiptSchema)) input: any,
  ) {
    return this.inboundService.createReceipt(clientId!, input, false);
  }

  @Get('inbound/:id')
  async getInbound(@TenantId() clientId: string, @Param('id') id: string) {
    return this.inboundService.getReceipt(clientId!, id, false);
  }
}
