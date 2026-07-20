import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  createOrderSchema,
  updateOrderSchema,
  cancelOrderSchema,
  createWaveSchema,
  confirmPickSchema,
  assignPickSchema,
  createCartonSchema,
  addCartonLineSchema,
  shipConfirmSchema,
  listOrdersQuerySchema,
  listWavesQuerySchema,
  listPickTasksQuerySchema,
} from '@wms/zod-schemas';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import type { RequestUser } from '../../common/types/request.types';
import { OutboundService } from './outbound.service';

@Controller()
export class OutboundController {
  constructor(private readonly outboundService: OutboundService) {}

  // ==================== OPS ROUTES ====================

  @Post('clients/:clientId/orders')
  async createOrderOps(
    @Param('clientId') clientId: string,
    @Body(new ZodValidationPipe(createOrderSchema)) input: any,
  ) {
    return this.outboundService.createOrder(clientId, input, true);
  }

  @Get('clients/:clientId/orders')
  async listOrdersOps(
    @Param('clientId') clientId: string,
    @Query(new ZodValidationPipe(listOrdersQuerySchema)) query: any,
  ) {
    return this.outboundService.listOrders(
      clientId,
      {
        status: query.status,
        warehouseId: query.warehouseId,
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

  @Get('clients/:clientId/orders/:id')
  async getOrderOps(
    @Param('clientId') clientId: string,
    @Param('id') orderId: string,
  ) {
    return this.outboundService.getOrder(clientId, orderId, true);
  }

  @Patch('clients/:clientId/orders/:id')
  async updateOrderOps(
    @Param('clientId') clientId: string,
    @Param('id') orderId: string,
    @Body(new ZodValidationPipe(updateOrderSchema)) input: any,
  ) {
    return this.outboundService.updateOrder(clientId, orderId, input, true);
  }

  @Post('clients/:clientId/orders/:id/cancel')
  async cancelOrderOps(
    @Param('clientId') clientId: string,
    @Param('id') orderId: string,
    @Body(new ZodValidationPipe(cancelOrderSchema)) input: any,
  ) {
    return this.outboundService.cancelOrder(clientId, orderId, input, true);
  }

  @Post('clients/:clientId/orders/:id/allocate')
  async allocateOrderOps(
    @Param('clientId') clientId: string,
    @Param('id') orderId: string,
  ) {
    return this.outboundService.allocateOrder(clientId, orderId);
  }

  @Post('clients/:clientId/orders/:id/ship')
  async shipConfirmOps(
    @Param('clientId') clientId: string,
    @Param('id') orderId: string,
    @Body(new ZodValidationPipe(shipConfirmSchema)) input: any,
  ) {
    return this.outboundService.shipConfirm(clientId, orderId, input);
  }

  @Post('clients/:clientId/orders/:orderId/cartons')
  async createCartonOps(
    @Param('clientId') clientId: string,
    @Param('orderId') orderId: string,
    @Body(new ZodValidationPipe(createCartonSchema)) input: any,
  ) {
    return this.outboundService.createCarton(clientId, orderId, input);
  }

  @Post('clients/:clientId/orders/:orderId/cartons/:cartonId/lines')
  async addCartonLineOps(
    @Param('clientId') clientId: string,
    @Param('orderId') orderId: string,
    @Param('cartonId') cartonId: string,
    @Body(new ZodValidationPipe(addCartonLineSchema)) input: any,
  ) {
    return this.outboundService.addCartonLine(clientId, orderId, cartonId, input);
  }

  @Post('clients/:clientId/orders/:orderId/cartons/:cartonId/close')
  async closeCartonOps(
    @Param('clientId') clientId: string,
    @Param('orderId') orderId: string,
    @Param('cartonId') cartonId: string,
  ) {
    return this.outboundService.closeCarton(clientId, orderId, cartonId);
  }

  // ==================== WAVE ROUTES ====================

  @Post('warehouses/:warehouseId/waves')
  async createWaveOps(
    @Body(new ZodValidationPipe(createWaveSchema)) input: any,
    @CurrentUser() user: RequestUser,
  ) {
    return this.outboundService.createWave(input, user.sub);
  }

  @Get('warehouses/:warehouseId/waves')
  async listWavesOps(
    @Param('warehouseId') warehouseId: string,
    @Query(new ZodValidationPipe(listWavesQuerySchema)) query: any,
  ) {
    return this.outboundService.listWaves(
      {
        warehouseId,
        status: query.status,
      },
      {
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
    );
  }

  @Get('waves/:id')
  async getWaveOps(@Param('id') waveId: string) {
    return this.outboundService.getWave(waveId);
  }

  @Post('waves/:id/release')
  async releaseWaveOps(@Param('id') waveId: string) {
    return this.outboundService.releaseWave(waveId);
  }

  // ==================== PICK ROUTES ====================

  @Get('warehouses/:warehouseId/pick-tasks')
  async listPickTasksOps(
    @Param('warehouseId') warehouseId: string,
    @Query(new ZodValidationPipe(listPickTasksQuerySchema)) query: any,
  ) {
    return this.outboundService.listPickTasks(
      {
        warehouseId,
        status: query.status,
        waveId: query.waveId,
        assignedTo: query.assignedTo,
      },
      {
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
    );
  }

  @Post('pick-tasks/:id/assign')
  async assignPickOps(
    @Param('id') taskId: string,
    @Body(new ZodValidationPipe(assignPickSchema)) input: any,
  ) {
    return this.outboundService.assignPick(taskId, input.assignedTo);
  }

  @Post('pick-tasks/:id/confirm')
  async confirmPickOps(
    @Param('id') taskId: string,
    @Body(new ZodValidationPipe(confirmPickSchema)) input: any,
  ) {
    return this.outboundService.confirmPick(taskId, input);
  }

  // ==================== PORTAL ROUTES ====================

  @Post('portal/orders')
  async createOrderPortal(
    @TenantId() clientId: string,
    @Body(new ZodValidationPipe(createOrderSchema)) input: any,
  ) {
    if (!clientId) {
      throw new Error('Client ID not found in request context');
    }
    return this.outboundService.createOrder(clientId, input, false);
  }

  @Get('portal/orders')
  async listOrdersPortal(
    @TenantId() clientId: string,
    @Query(new ZodValidationPipe(listOrdersQuerySchema)) query: any,
  ) {
    if (!clientId) {
      throw new Error('Client ID not found in request context');
    }
    return this.outboundService.listOrders(
      clientId,
      {
        status: query.status,
        warehouseId: query.warehouseId,
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

  @Get('portal/orders/:id')
  async getOrderPortal(
    @TenantId() clientId: string,
    @Param('id') orderId: string,
  ) {
    if (!clientId) {
      throw new Error('Client ID not found in request context');
    }
    return this.outboundService.getOrder(clientId, orderId, false);
  }

  @Post('portal/orders/:id/cancel')
  async cancelOrderPortal(
    @TenantId() clientId: string,
    @Param('id') orderId: string,
    @Body(new ZodValidationPipe(cancelOrderSchema)) input: any,
  ) {
    if (!clientId) {
      throw new Error('Client ID not found in request context');
    }
    return this.outboundService.cancelOrder(clientId, orderId, input, false);
  }
}
