import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  createReceiptSchema,
  receiveLineSchema,
  putawaySchema,
  createAppointmentSchema,
  updateAppointmentSchema,
  checkInAppointmentSchema,
  listReceiptsQuerySchema,
  listAppointmentsQuerySchema,
} from '@wms/zod-schemas';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import type { RequestUser } from '../../common/types/request.types';
import { InboundService } from './inbound.service';

@Controller()
export class InboundController {
  constructor(private readonly inboundService: InboundService) {}

  // ==================== OPS ROUTES ====================

  @Post('clients/:clientId/receipts')
  async createReceiptOps(
    @Param('clientId') clientId: string,
    @Body(new ZodValidationPipe(createReceiptSchema)) input: any,
  ) {
    return this.inboundService.createReceipt(clientId, input, true);
  }

  @Get('clients/:clientId/receipts')
  async listReceiptsOps(
    @Param('clientId') clientId: string,
    @Query(new ZodValidationPipe(listReceiptsQuerySchema)) query: any,
  ) {
    return this.inboundService.listReceipts(
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

  @Get('clients/:clientId/receipts/:id')
  async getReceiptOps(
    @Param('clientId') clientId: string,
    @Param('id') receiptId: string,
  ) {
    return this.inboundService.getReceipt(clientId, receiptId, true);
  }

  @Post('clients/:clientId/receipts/:id/check-in')
  async checkInReceiptOps(
    @Param('clientId') clientId: string,
    @Param('id') receiptId: string,
  ) {
    return this.inboundService.checkInReceipt(clientId, receiptId);
  }

  @Post('clients/:clientId/receipts/:id/lines/:lineId/receive')
  async receiveLineOps(
    @Param('clientId') clientId: string,
    @Param('lineId') lineId: string,
    @Body(new ZodValidationPipe(receiveLineSchema)) input: any,
    @CurrentUser() user: RequestUser,
  ) {
    return this.inboundService.receiveLine(clientId, lineId, input, user.sub);
  }

  @Post('clients/:clientId/receipts/:id/complete')
  async completeReceiptOps(
    @Param('clientId') clientId: string,
    @Param('id') receiptId: string,
  ) {
    return this.inboundService.completeReceipt(clientId, receiptId);
  }

  @Post('clients/:clientId/lots/:lotId/putaway')
  async confirmPutawayOps(
    @Param('clientId') clientId: string,
    @Param('lotId') lotId: string,
    @Body(new ZodValidationPipe(putawaySchema)) input: any,
    @CurrentUser() user: RequestUser,
  ) {
    return this.inboundService.confirmPutaway(
      clientId,
      lotId,
      input,
      user.sub,
    );
  }

  @Get('clients/:clientId/putaway/suggest/:lotId')
  async suggestPutawayOps(
    @Param('clientId') clientId: string,
    @Param('lotId') lotId: string,
  ) {
    return this.inboundService.suggestPutaway(clientId, lotId);
  }

  @Post('clients/:clientId/appointments')
  async createAppointmentByClientOps(
    @Body(new ZodValidationPipe(createAppointmentSchema)) input: any,
  ) {
    return this.inboundService.createAppointment(input);
  }

  @Get('clients/:clientId/appointments')
  async listAppointmentsByClientOps(
    @Query(new ZodValidationPipe(listAppointmentsQuerySchema)) query: any,
  ) {
    return this.inboundService.listAppointments(
      {
        warehouseId: query.warehouseId,
        dockCode: query.dockCode,
        status: query.status,
        from: query.from,
        to: query.to,
      },
      {
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
    );
  }

  @Post('warehouses/:warehouseId/appointments')
  async createAppointmentByWarehouseOps(
    @Body(new ZodValidationPipe(createAppointmentSchema)) input: any,
  ) {
    return this.inboundService.createAppointment(input);
  }

  @Get('warehouses/:warehouseId/appointments')
  async listAppointmentsByWarehouseOps(
    @Param('warehouseId') warehouseId: string,
    @Query(new ZodValidationPipe(listAppointmentsQuerySchema)) query: any,
  ) {
    return this.inboundService.listAppointments(
      {
        warehouseId,
        dockCode: query.dockCode,
        status: query.status,
        from: query.from,
        to: query.to,
      },
      {
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
    );
  }

  @Get('warehouses/:warehouseId/appointments/:id')
  async getAppointmentOps(@Param('id') appointmentId: string) {
    return this.inboundService.getAppointment(appointmentId);
  }

  @Patch('warehouses/:warehouseId/appointments/:id')
  async updateAppointmentOps(
    @Param('id') appointmentId: string,
    @Body(new ZodValidationPipe(updateAppointmentSchema)) data: any,
  ) {
    return this.inboundService.updateAppointment(appointmentId, data);
  }

  @Post('warehouses/:warehouseId/appointments/:id/check-in')
  async checkInAppointmentOps(
    @Param('id') appointmentId: string,
    @Body() body?: unknown,
  ) {
    const data = checkInAppointmentSchema.parse(body ?? {});
    return this.inboundService.checkInAppointment(
      appointmentId,
      data.receiptId,
    );
  }

  @Delete('warehouses/:warehouseId/appointments/:id')
  async deleteAppointmentOps(@Param('id') appointmentId: string) {
    return this.inboundService.deleteAppointment(appointmentId);
  }

  // ==================== PORTAL ROUTES ====================

  @Post('portal/receipts')
  async createReceiptPortal(
    @TenantId() clientId: string,
    @Body(new ZodValidationPipe(createReceiptSchema)) input: any,
  ) {
    if (!clientId) {
      throw new Error('Client ID not found in request context');
    }
    return this.inboundService.createReceipt(clientId, input, false);
  }

  @Get('portal/receipts')
  async listReceiptsPortal(
    @TenantId() clientId: string,
    @Query(new ZodValidationPipe(listReceiptsQuerySchema)) query: any,
  ) {
    if (!clientId) {
      throw new Error('Client ID not found in request context');
    }
    return this.inboundService.listReceipts(
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

  @Get('portal/receipts/:id')
  async getReceiptPortal(
    @TenantId() clientId: string,
    @Param('id') receiptId: string,
  ) {
    if (!clientId) {
      throw new Error('Client ID not found in request context');
    }
    return this.inboundService.getReceipt(clientId, receiptId, false);
  }

  @Post('portal/appointments')
  async createAppointmentPortal(
    @Body(new ZodValidationPipe(createAppointmentSchema)) input: any,
  ) {
    return this.inboundService.createAppointment(input);
  }
}
