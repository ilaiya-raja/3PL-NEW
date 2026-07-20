import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  listInventoryQuerySchema,
  placeHoldSchema,
  createAdjustmentSchema,
  listHoldsQuerySchema,
  listAdjustmentsQuerySchema,
  type ListInventoryQuery,
} from '@wms/zod-schemas';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import type { RequestUser } from '../../common/types/request.types';
import { InventoryService } from './inventory.service';

@Controller()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ==================== OPS ROUTES ====================

  @Get('inventory')
  async listAllInventoryOps(
    @Query(new ZodValidationPipe(listInventoryQuerySchema)) query: ListInventoryQuery,
  ) {
    return this.inventoryService.listAllInventoryOps(query);
  }

  @Get('clients/:clientId/inventory')
  async listInventoryOps(
    @Param('clientId') clientId: string,
    @Query(new ZodValidationPipe(listInventoryQuerySchema)) query: any,
  ) {
    return this.inventoryService.listInventory(clientId, query, true);
  }

  @Get('clients/:clientId/inventory/:itemId')
  async getInventoryByItemOps(
    @Param('clientId') clientId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.inventoryService.getInventoryByItem(clientId, itemId, true);
  }

  @Get('clients/:clientId/inventory/lots/:lotId/history')
  async getLotHistoryOps(
    @Param('clientId') clientId: string,
    @Param('lotId') lotId: string,
    @Query(new ZodValidationPipe(listInventoryQuerySchema)) query: any,
  ) {
    return this.inventoryService.getLotHistory(
      clientId,
      lotId,
      {
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
      true,
    );
  }

  @Post('clients/:clientId/holds')
  async placeHoldOps(
    @Param('clientId') clientId: string,
    @Body(new ZodValidationPipe(placeHoldSchema)) input: any,
    @CurrentUser() user: RequestUser,
  ) {
    return this.inventoryService.placeHold(clientId, input, user.sub, true);
  }

  @Get('clients/:clientId/holds')
  async listHoldsOps(
    @Param('clientId') clientId: string,
    @Query(new ZodValidationPipe(listHoldsQuerySchema)) query: any,
  ) {
    return this.inventoryService.listHolds(
      clientId,
      {
        active: query.active,
        holdType: query.holdType,
      },
      {
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
      true,
    );
  }

  @Post('clients/:clientId/holds/:id/release')
  async releaseHoldOps(
    @Param('clientId') clientId: string,
    @Param('id') holdId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.inventoryService.releaseHold(clientId, holdId, user.sub, true);
  }

  @Post('clients/:clientId/adjustments')
  async createAdjustmentOps(
    @Param('clientId') clientId: string,
    @Body(new ZodValidationPipe(createAdjustmentSchema)) input: any,
    @CurrentUser() user: RequestUser,
  ) {
    return this.inventoryService.createAdjustment(
      clientId,
      input,
      user.sub,
      true,
    );
  }

  @Get('clients/:clientId/adjustments')
  async listAdjustmentsOps(
    @Param('clientId') clientId: string,
    @Query(new ZodValidationPipe(listAdjustmentsQuerySchema)) query: any,
  ) {
    return this.inventoryService.listAdjustments(
      clientId,
      { status: query.status },
      {
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
      true,
    );
  }

  @Post('clients/:clientId/adjustments/:id/approve')
  async approveAdjustmentOps(
    @Param('clientId') clientId: string,
    @Param('id') adjustmentId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.inventoryService.approveAdjustment(
      clientId,
      adjustmentId,
      user.sub,
    );
  }

  @Post('clients/:clientId/adjustments/:id/reject')
  async rejectAdjustmentOps(
    @Param('clientId') clientId: string,
    @Param('id') adjustmentId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.inventoryService.rejectAdjustment(
      clientId,
      adjustmentId,
      user.sub,
    );
  }

  // ==================== PORTAL ROUTES ====================

  @Get('portal/inventory')
  async listInventoryPortal(
    @TenantId() clientId: string,
    @Query(new ZodValidationPipe(listInventoryQuerySchema)) query: any,
  ) {
    if (!clientId) {
      throw new Error('Client ID not found in request context');
    }
    return this.inventoryService.listInventory(clientId, query, false);
  }

  @Get('portal/inventory/:itemId')
  async getInventoryByItemPortal(
    @TenantId() clientId: string,
    @Param('itemId') itemId: string,
  ) {
    if (!clientId) {
      throw new Error('Client ID not found in request context');
    }
    return this.inventoryService.getInventoryByItem(clientId, itemId, false);
  }

  @Get('portal/holds')
  async listHoldsPortal(
    @TenantId() clientId: string,
    @Query(new ZodValidationPipe(listHoldsQuerySchema)) query: any,
  ) {
    if (!clientId) {
      throw new Error('Client ID not found in request context');
    }
    return this.inventoryService.listHolds(
      clientId,
      {
        active: query.active,
        holdType: query.holdType,
      },
      {
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
      false,
    );
  }

  @Post('portal/adjustments')
  async createAdjustmentPortal(
    @TenantId() clientId: string,
    @Body(new ZodValidationPipe(createAdjustmentSchema)) input: any,
    @CurrentUser() user: RequestUser,
  ) {
    if (!clientId) {
      throw new Error('Client ID not found in request context');
    }
    return this.inventoryService.createAdjustment(
      clientId,
      input,
      user.sub,
      false,
    );
  }
}
