import { HttpStatus, Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { ErrorCodes } from '@wms/types';
import type {
  CreateReceiptInput,
  ReceiveLineInput,
  PutawayInput,
  CreateAppointmentInput,
} from '@wms/zod-schemas';
import { TenantPrismaService } from '../../database/tenant-prisma.service';
import { WmsException } from '../../common/exceptions/wms.exception';
import type { PaginationParams } from '../../common/utils/pagination';
import { calculatePagination } from '../../common/utils/pagination';
import { InboundRepository } from './inbound.repository';
import { InventoryTransactionService } from '../inventory/inventory-transaction.service';

@Injectable()
export class InboundService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly repository: InboundRepository,
    private readonly transactionService: InventoryTransactionService,
  ) {}

  async createReceipt(
    clientId: string,
    input: CreateReceiptInput,
    useOpsRole = false,
  ) {
    if (useOpsRole) {
      return this.tenantPrisma.withOpsRole(async (tx) => {
        return this.createReceiptLogic(clientId, input, tx);
      });
    } else {
      return this.tenantPrisma.withTenant(clientId, async (tx) => {
        return this.createReceiptLogic(clientId, input, tx);
      });
    }
  }

  private async createReceiptLogic(
    clientId: string,
    input: CreateReceiptInput,
    tx: any,
  ) {
    const receipt = await this.repository.createReceipt(
      {
        clientId,
        warehouseId: input.warehouseId,
        asnNumber: input.asnNumber,
        expectedDate: input.expectedDate
          ? new Date(input.expectedDate)
          : undefined,
        carrierName: input.carrierName,
        vehicleRef: input.vehicleRef,
        sealNumber: input.sealNumber,
        notes: input.notes,
        lines: input.lines.map((line) => ({
          itemId: line.itemId,
          expectedQty: line.expectedQty.toString(),
          lotNumber: line.lotNumber,
          expiryDate: line.expiryDate ? new Date(line.expiryDate) : undefined,
          notes: line.notes,
        })),
      },
      tx,
    );

    return receipt;
  }

  async listReceipts(
    clientId: string,
    filter: { status?: string; warehouseId?: string },
    pagination: PaginationParams,
    useOpsRole = false,
  ) {
    if (useOpsRole) {
      return this.tenantPrisma.withOpsRole(async (tx) => {
        const { receipts, total } = await this.repository.findReceipts(
          {
            clientId,
            status: filter.status as any,
            warehouseId: filter.warehouseId,
          },
          pagination,
          tx,
        );

        return {
          data: receipts,
          pagination: calculatePagination(
            pagination.page,
            pagination.limit,
            total,
          ),
        };
      });
    } else {
      return this.tenantPrisma.withTenant(clientId, async (tx) => {
        const { receipts, total } = await this.repository.findReceipts(
          {
            clientId,
            status: filter.status as any,
            warehouseId: filter.warehouseId,
          },
          pagination,
          tx,
        );

        return {
          data: receipts,
          pagination: calculatePagination(
            pagination.page,
            pagination.limit,
            total,
          ),
        };
      });
    }
  }

  async getReceipt(clientId: string, receiptId: string, useOpsRole = false) {
    if (useOpsRole) {
      return this.tenantPrisma.withOpsRole(async (tx) => {
        const receipt = await this.repository.findReceiptById(receiptId, tx);

        if (!receipt || receipt.clientId !== clientId) {
          throw new WmsException(
            ErrorCodes.INB_RECEIPT_NOT_FOUND,
            'Receipt not found',
            HttpStatus.NOT_FOUND,
          );
        }

        return receipt;
      });
    } else {
      return this.tenantPrisma.withTenant(clientId, async (tx) => {
        const receipt = await this.repository.findReceiptById(receiptId, tx);

        if (!receipt || receipt.clientId !== clientId) {
          throw new WmsException(
            ErrorCodes.INB_RECEIPT_NOT_FOUND,
            'Receipt not found',
            HttpStatus.NOT_FOUND,
          );
        }

        return receipt;
      });
    }
  }

  async checkInReceipt(clientId: string, receiptId: string) {
    return this.tenantPrisma.withTenant(clientId, async (tx) => {
      const receipt = await this.repository.findReceiptById(receiptId, tx);

      if (!receipt || receipt.clientId !== clientId) {
        throw new WmsException(
          ErrorCodes.INB_RECEIPT_NOT_FOUND,
          'Receipt not found',
          HttpStatus.NOT_FOUND,
        );
      }

      if (receipt.status !== 'EXPECTED') {
        throw new WmsException(
          ErrorCodes.INB_INVALID_STATUS,
          'Receipt must be in EXPECTED status',
          HttpStatus.BAD_REQUEST,
        );
      }

      return this.repository.updateReceiptStatus(
        receiptId,
        'ARRIVED',
        tx,
        { arrivedAt: new Date() },
      );
    });
  }

  async receiveLine(
    clientId: string,
    lineId: string,
    input: ReceiveLineInput,
    actorId: string,
  ) {
    return this.tenantPrisma.withTenant(clientId, async (tx) => {
      const line = await this.repository.findLineById(lineId, tx);

      if (!line || line.clientId !== clientId) {
        throw new WmsException(
          ErrorCodes.INB_LINE_NOT_FOUND,
          'Receipt line not found',
          HttpStatus.NOT_FOUND,
        );
      }

      const receipt = line.receipt;

      if (receipt.status !== 'ARRIVED' && receipt.status !== 'RECEIVING') {
        throw new WmsException(
          ErrorCodes.INB_INVALID_STATUS,
          'Receipt must be ARRIVED or RECEIVING',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (receipt.status === 'ARRIVED') {
        await this.repository.updateReceiptStatus(
          receipt.id,
          'RECEIVING',
          tx,
        );
      }

      const receivedQty = new Decimal(input.receivedQty.toString());
      const damagedQty = new Decimal(input.damagedQty?.toString() || '0');
      const totalReceived = receivedQty.plus(damagedQty);

      const currentTotal = new Decimal(line.receivedQty)
        .plus(line.damagedQty)
        .plus(totalReceived);
      const expectedQty = new Decimal(line.expectedQty);

      let shortQty: string | undefined;
      if (currentTotal.gte(expectedQty)) {
        const actualShort = expectedQty.minus(currentTotal);
        if (actualShort.gt(0)) {
          shortQty = actualShort.toString();
        } else {
          shortQty = '0';
        }
      }

      await this.repository.updateLineQuantities(
        lineId,
        {
          receivedQty: input.receivedQty.toString(),
          damagedQty: input.damagedQty?.toString() || '0',
          shortQty,
        },
        tx,
      );

      if (receivedQty.gt(0)) {
        const lot = await this.repository.upsertLot(
          {
            clientId,
            itemId: line.itemId,
            warehouseId: receipt.warehouseId,
            lotNumber:
              input.lotNumber || line.lotNumber || undefined,
            expiryDate: input.expiryDate
              ? new Date(input.expiryDate)
              : line.expiryDate ?? undefined,
            qtyOnHand: receivedQty.toString(),
            status: 'RECEIVED',
            receiptLineId: lineId,
          },
          tx,
        );

        await this.transactionService.writeLedger(
          {
            clientId,
            txnType: 'RECEIPT' as any,
            itemId: line.itemId,
            lotId: lot.id,
            toLocationId: null,
            qtyDelta: receivedQty.toString(),
            statusTo: 'RECEIVED' as any,
            refType: 'receipt',
            refId: receipt.id,
            actorId,
          },
          tx,
        );
      }

      if (damagedQty.gt(0)) {
        const damagedLot = await this.repository.upsertLot(
          {
            clientId,
            itemId: line.itemId,
            warehouseId: receipt.warehouseId,
            lotNumber:
              input.lotNumber || line.lotNumber || undefined,
            expiryDate: input.expiryDate
              ? new Date(input.expiryDate)
              : line.expiryDate ?? undefined,
            qtyOnHand: damagedQty.toString(),
            status: 'DAMAGED',
            receiptLineId: lineId,
          },
          tx,
        );

        await this.transactionService.writeLedger(
          {
            clientId,
            txnType: 'RECEIPT' as any,
            itemId: line.itemId,
            lotId: damagedLot.id,
            toLocationId: null,
            qtyDelta: damagedQty.toString(),
            statusTo: 'DAMAGED' as any,
            refType: 'receipt',
            refId: receipt.id,
            actorId,
            notes: 'Damaged on receipt',
          },
          tx,
        );
      }

      return { success: true };
    });
  }

  async completeReceipt(clientId: string, receiptId: string) {
    return this.tenantPrisma.withTenant(clientId, async (tx) => {
      const receipt = await this.repository.findReceiptById(receiptId, tx);

      if (!receipt || receipt.clientId !== clientId) {
        throw new WmsException(
          ErrorCodes.INB_RECEIPT_NOT_FOUND,
          'Receipt not found',
          HttpStatus.NOT_FOUND,
        );
      }

      if (receipt.status !== 'RECEIVING') {
        throw new WmsException(
          ErrorCodes.INB_INVALID_STATUS,
          'Receipt must be in RECEIVING status',
          HttpStatus.BAD_REQUEST,
        );
      }

      const allLinesComplete = receipt.lines.every((line) => {
        const received = new Decimal(line.receivedQty);
        const damaged = new Decimal(line.damagedQty);
        const short = new Decimal(line.shortQty);
        const expected = new Decimal(line.expectedQty);
        return received.plus(damaged).plus(short).eq(expected);
      });

      if (!allLinesComplete) {
        throw new WmsException(
          ErrorCodes.INB_INCOMPLETE_LINES,
          'All lines must be fully received',
          HttpStatus.BAD_REQUEST,
        );
      }

      await this.repository.updateReceiptStatus(
        receiptId,
        'COMPLETE',
        tx,
        { completedAt: new Date() },
      );

      const receivedLots = await this.repository.findReceivedLotsForReceipt(
        receiptId,
        tx,
      );

      const suggestions = await Promise.all(
        receivedLots.map(async (lot) => {
          const locations = await this.repository.findSuggestedLocations(
            lot.warehouseId,
            clientId,
            lot.item.tempClass,
            tx,
          );

          return {
            lotId: lot.id,
            itemId: lot.itemId,
            sku: lot.item.sku,
            qtyOnHand: lot.qtyOnHand.toString(),
            suggestedLocations: locations.slice(0, 5).map((loc) => ({
              locationId: loc.id,
              code: loc.code,
              type: loc.type,
              zoneType: loc.zone.type,
            })),
          };
        }),
      );

      return {
        success: true,
        putawaySuggestions: suggestions,
      };
    });
  }

  async confirmPutaway(
    clientId: string,
    lotId: string,
    input: PutawayInput,
    actorId: string,
  ) {
    return this.tenantPrisma.withTenant(clientId, async (tx) => {
      const lot = await this.repository.findLotById(lotId, tx);

      if (!lot || lot.clientId !== clientId) {
        throw new WmsException(
          ErrorCodes.INV_LOT_NOT_FOUND,
          'Lot not found',
          HttpStatus.NOT_FOUND,
        );
      }

      if (lot.status !== 'RECEIVED') {
        throw new WmsException(
          ErrorCodes.INV_INVALID_LOT_STATUS,
          'Lot must be in RECEIVED status',
          HttpStatus.BAD_REQUEST,
        );
      }

      const location = await this.repository.findLocationById(
        input.locationId,
        tx,
      );

      if (!location || location.warehouseId !== lot.warehouseId) {
        throw new WmsException(
          ErrorCodes.INV_LOCATION_NOT_FOUND,
          'Location not found or in different warehouse',
          HttpStatus.NOT_FOUND,
        );
      }

      if (!location.active) {
        throw new WmsException(
          ErrorCodes.INV_LOCATION_INACTIVE,
          'Location is inactive',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (location.zone.tempClass !== lot.item.tempClass) {
        throw new WmsException(
          ErrorCodes.INV_TEMP_CLASS_MISMATCH,
          'Location temp class does not match item',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (lot.item.hazmatClass && !location.zone.hazmatAllowed) {
        throw new WmsException(
          ErrorCodes.INV_HAZMAT_NOT_ALLOWED,
          'Location does not allow hazmat',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (location.clientId && location.clientId !== clientId) {
        throw new WmsException(
          ErrorCodes.INV_LOCATION_RESERVED,
          'Location is reserved for another client',
          HttpStatus.BAD_REQUEST,
        );
      }

      const oldStatus = lot.status;

      await this.repository.updateLotLocation(
        lotId,
        input.locationId,
        'AVAILABLE',
        tx,
      );

      await this.transactionService.writeLedger(
        {
          clientId,
          txnType: 'PUTAWAY' as any,
          itemId: lot.itemId,
          lotId: lot.id,
          fromLocationId: null,
          toLocationId: input.locationId,
          qtyDelta: '0',
          statusFrom: oldStatus as any,
          statusTo: 'AVAILABLE' as any,
          refType: 'putaway',
          refId: lotId,
          actorId,
        },
        tx,
      );

      return { success: true };
    });
  }

  async suggestPutaway(clientId: string, lotId: string) {
    return this.tenantPrisma.withTenant(clientId, async (tx) => {
      const lot = await this.repository.findLotById(lotId, tx);

      if (!lot || lot.clientId !== clientId) {
        throw new WmsException(
          ErrorCodes.INV_LOT_NOT_FOUND,
          'Lot not found',
          HttpStatus.NOT_FOUND,
        );
      }

      const locations = await this.repository.findSuggestedLocations(
        lot.warehouseId,
        clientId,
        lot.item.tempClass,
        tx,
      );

      return {
        lotId: lot.id,
        itemId: lot.itemId,
        sku: lot.item.sku,
        qtyOnHand: lot.qtyOnHand.toString(),
        suggestions: locations.map((loc) => ({
          locationId: loc.id,
          code: loc.code,
          type: loc.type,
          zoneType: loc.zone.type,
          zoneName: loc.zone.name,
          tempClass: loc.zone.tempClass,
          hazmatAllowed: loc.zone.hazmatAllowed,
        })),
      };
    });
  }

  async createAppointment(input: CreateAppointmentInput) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const appointment = await this.repository.createAppointment(
        {
          warehouseId: input.warehouseId,
          receiptId: input.receiptId ?? undefined,
          dockCode: input.dockCode,
          scheduledAt: new Date(input.scheduledAt),
          durationMinutes: input.durationMinutes,
          carrierName: input.carrierName,
          vehicleRef: input.vehicleRef,
          driverName: input.driverName,
          driverPhone: input.driverPhone,
        },
        tx,
      );

      return appointment;
    });
  }

  async listAppointments(
    filter: {
      warehouseId?: string;
      dockCode?: string;
      status?: string;
      from?: string;
      to?: string;
    },
    pagination: PaginationParams,
  ) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const { appointments, total } = await this.repository.findAppointments(
        {
          warehouseId: filter.warehouseId,
          dockCode: filter.dockCode,
          status: filter.status as any,
          from: filter.from ? new Date(filter.from) : undefined,
          to: filter.to ? new Date(filter.to) : undefined,
        },
        pagination,
        tx,
      );

      return {
        data: appointments,
        pagination: calculatePagination(
          pagination.page,
          pagination.limit,
          total,
        ),
      };
    });
  }

  async getAppointment(appointmentId: string) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const appointment = await this.repository.findAppointmentById(
        appointmentId,
        tx,
      );

      if (!appointment) {
        throw new WmsException(
          ErrorCodes.INB_APPOINTMENT_NOT_FOUND,
          'Appointment not found',
          HttpStatus.NOT_FOUND,
        );
      }

      return appointment;
    });
  }

  async updateAppointment(appointmentId: string, data: any) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const appointment = await this.repository.findAppointmentById(
        appointmentId,
        tx,
      );

      if (!appointment) {
        throw new WmsException(
          ErrorCodes.INB_APPOINTMENT_NOT_FOUND,
          'Appointment not found',
          HttpStatus.NOT_FOUND,
        );
      }

      return this.repository.updateAppointment(
        appointmentId,
        {
          ...(data.dockCode && { dockCode: data.dockCode }),
          ...(data.scheduledAt && { scheduledAt: new Date(data.scheduledAt) }),
          ...(data.durationMinutes !== undefined && {
            durationMinutes: data.durationMinutes,
          }),
          ...(data.carrierName !== undefined && {
            carrierName: data.carrierName,
          }),
          ...(data.vehicleRef !== undefined && { vehicleRef: data.vehicleRef }),
          ...(data.driverName !== undefined && { driverName: data.driverName }),
          ...(data.driverPhone !== undefined && {
            driverPhone: data.driverPhone,
          }),
          ...(data.status && { status: data.status }),
          ...(data.receiptId !== undefined && { receiptId: data.receiptId }),
        },
        tx,
      );
    });
  }

  async checkInAppointment(appointmentId: string, receiptId?: string | null) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const appointment = await this.repository.findAppointmentById(
        appointmentId,
        tx,
      );

      if (!appointment) {
        throw new WmsException(
          ErrorCodes.INB_APPOINTMENT_NOT_FOUND,
          'Appointment not found',
          HttpStatus.NOT_FOUND,
        );
      }

      if (appointment.status !== 'SCHEDULED') {
        throw new WmsException(
          ErrorCodes.INB_INVALID_STATUS,
          'Only scheduled appointments can be checked in',
          HttpStatus.BAD_REQUEST,
        );
      }

      return this.repository.updateAppointment(
        appointmentId,
        {
          status: 'CHECKED_IN',
          checkedInAt: new Date(),
          ...(receiptId !== undefined && { receiptId }),
        },
        tx,
      );
    });
  }

  async deleteAppointment(appointmentId: string) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const appointment = await this.repository.findAppointmentById(
        appointmentId,
        tx,
      );

      if (!appointment) {
        throw new WmsException(
          ErrorCodes.INB_APPOINTMENT_NOT_FOUND,
          'Appointment not found',
          HttpStatus.NOT_FOUND,
        );
      }

      if (appointment.status !== 'SCHEDULED') {
        throw new WmsException(
          ErrorCodes.INB_INVALID_STATUS,
          'Only scheduled appointments can be deleted',
          HttpStatus.BAD_REQUEST,
        );
      }

      await this.repository.deleteAppointment(appointmentId, tx);

      return { success: true };
    });
  }
}
