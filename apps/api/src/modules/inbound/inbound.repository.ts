import { Injectable } from '@nestjs/common';
import { Prisma, ReceiptStatus, LotStatus, AppointmentStatus } from '@wms/db';
import type { PaginationParams } from '../../common/utils/pagination';

export interface FindReceiptsFilter {
  clientId: string;
  status?: ReceiptStatus;
  warehouseId?: string;
}

@Injectable()
export class InboundRepository {
  async createReceipt(
    data: {
      clientId: string;
      warehouseId: string;
      asnNumber?: string;
      expectedDate?: Date;
      carrierName?: string;
      vehicleRef?: string;
      sealNumber?: string;
      notes?: string;
      lines: Array<{
        itemId: string;
        expectedQty: string;
        lotNumber?: string;
        expiryDate?: Date;
        notes?: string;
      }>;
    },
    tx: Prisma.TransactionClient,
  ) {
    return tx.inboundReceipt.create({
      data: {
        clientId: data.clientId,
        warehouseId: data.warehouseId,
        asnNumber: data.asnNumber ?? null,
        expectedDate: data.expectedDate ?? null,
        carrierName: data.carrierName ?? null,
        vehicleRef: data.vehicleRef ?? null,
        sealNumber: data.sealNumber ?? null,
        notes: data.notes ?? null,
        status: 'EXPECTED',
        lines: {
          create: data.lines.map((line) => ({
            clientId: data.clientId,
            itemId: line.itemId,
            expectedQty: line.expectedQty,
            lotNumber: line.lotNumber ?? null,
            expiryDate: line.expiryDate ?? null,
            notes: line.notes ?? null,
          })),
        },
      },
      include: {
        lines: { include: { item: true } },
        warehouse: true,
      },
    });
  }

  async findReceipts(
    filter: FindReceiptsFilter,
    pagination: PaginationParams,
    tx: Prisma.TransactionClient,
  ) {
    const { clientId, status, warehouseId } = filter;
    const { page, limit, sortBy = 'createdAt', sortOrder } = pagination;

    const where: Prisma.InboundReceiptWhereInput = {
      clientId,
      ...(status && { status }),
      ...(warehouseId && { warehouseId }),
    };

    const skip = (page - 1) * limit;

    const [receipts, total] = await Promise.all([
      tx.inboundReceipt.findMany({
        where,
        select: {
          id: true,
          clientId: true,
          asnNumber: true,
          status: true,
          expectedDate: true,
          arrivedAt: true,
          completedAt: true,
          carrierName: true,
          createdAt: true,
          updatedAt: true,
          warehouse: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          _count: {
            select: {
              lines: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      tx.inboundReceipt.count({ where }),
    ]);

    return { receipts, total };
  }

  async findReceiptById(receiptId: string, tx: Prisma.TransactionClient) {
    return tx.inboundReceipt.findUnique({
      where: { id: receiptId },
      include: {
        warehouse: true,
        lines: { include: { item: true } },
      },
    });
  }

  async updateReceiptStatus(
    receiptId: string,
    status: ReceiptStatus,
    tx: Prisma.TransactionClient,
    updates?: { arrivedAt?: Date; completedAt?: Date },
  ) {
    return tx.inboundReceipt.update({
      where: { id: receiptId },
      data: {
        status,
        ...(updates?.arrivedAt && { arrivedAt: updates.arrivedAt }),
        ...(updates?.completedAt && { completedAt: updates.completedAt }),
      },
    });
  }

  async findLineById(lineId: string, tx: Prisma.TransactionClient) {
    return tx.inboundLine.findUnique({
      where: { id: lineId },
      include: {
        item: true,
        receipt: true,
      },
    });
  }

  async updateLineQuantities(
    lineId: string,
    data: {
      receivedQty?: string;
      damagedQty?: string;
      shortQty?: string;
    },
    tx: Prisma.TransactionClient,
  ) {
    return tx.inboundLine.update({
      where: { id: lineId },
      data: {
        ...(data.receivedQty !== undefined && {
          receivedQty: { increment: data.receivedQty },
        }),
        ...(data.damagedQty !== undefined && {
          damagedQty: { increment: data.damagedQty },
        }),
        ...(data.shortQty !== undefined && { shortQty: data.shortQty }),
      },
    });
  }

  async upsertLot(
    data: {
      clientId: string;
      itemId: string;
      warehouseId: string;
      lotNumber?: string;
      expiryDate?: Date;
      qtyOnHand: string;
      status: LotStatus;
      receiptLineId: string;
    },
    tx: Prisma.TransactionClient,
  ) {
    // Try to find existing lot with same attributes
    const existing = await tx.inventoryLot.findFirst({
      where: {
        clientId: data.clientId,
        itemId: data.itemId,
        warehouseId: data.warehouseId,
        lotNumber: data.lotNumber ?? null,
        expiryDate: data.expiryDate ?? null,
        status: data.status,
        locationId: null,
      },
    });

    if (existing) {
      // Update existing
      return tx.inventoryLot.update({
        where: { id: existing.id },
        data: {
          qtyOnHand: { increment: data.qtyOnHand },
        },
      });
    } else {
      // Create new
      return tx.inventoryLot.create({
        data: {
          clientId: data.clientId,
          itemId: data.itemId,
          warehouseId: data.warehouseId,
          lotNumber: data.lotNumber ?? null,
          expiryDate: data.expiryDate ?? null,
          qtyOnHand: data.qtyOnHand,
          status: data.status,
          receiptLineId: data.receiptLineId,
        },
      });
    }
  }

  async findLotById(lotId: string, tx: Prisma.TransactionClient) {
    return tx.inventoryLot.findUnique({
      where: { id: lotId },
      include: {
        item: true,
        location: { include: { zone: true } },
        warehouse: true,
      },
    });
  }

  async findLocationById(locationId: string, tx: Prisma.TransactionClient) {
    return tx.location.findUnique({
      where: { id: locationId },
      include: {
        zone: true,
      },
    });
  }

  async updateLotLocation(
    lotId: string,
    locationId: string,
    status: LotStatus,
    tx: Prisma.TransactionClient,
  ) {
    return tx.inventoryLot.update({
      where: { id: lotId },
      data: {
        locationId,
        status,
      },
    });
  }

  async findSuggestedLocations(
    warehouseId: string,
    clientId: string,
    tempClass: string,
    tx: Prisma.TransactionClient,
  ) {
    return tx.location.findMany({
      where: {
        warehouseId,
        active: true,
        zone: {
          tempClass: tempClass as any,
        },
        OR: [{ clientId: null }, { clientId }],
      },
      include: {
        zone: true,
      },
      orderBy: [
        { type: 'asc' }, // PICK_FACE first
        { pickSequence: 'asc' },
      ],
      take: 20,
    });
  }

  async findReceivedLotsForReceipt(
    receiptId: string,
    tx: Prisma.TransactionClient,
  ) {
    return tx.inventoryLot.findMany({
      where: {
        receiptLineId: receiptId,
        status: 'RECEIVED',
        locationId: null,
      },
      include: {
        item: true,
      },
    });
  }

  async createAppointment(
    data: {
      warehouseId: string;
      receiptId?: string;
      dockCode: string;
      scheduledAt: Date;
      durationMinutes: number;
      carrierName?: string;
      vehicleRef?: string;
      driverName?: string;
      driverPhone?: string;
    },
    tx: Prisma.TransactionClient,
  ) {
    return tx.dockAppointment.create({
      data: {
        warehouseId: data.warehouseId,
        receiptId: data.receiptId ?? null,
        dockCode: data.dockCode,
        scheduledAt: data.scheduledAt,
        durationMinutes: data.durationMinutes,
        carrierName: data.carrierName ?? null,
        vehicleRef: data.vehicleRef ?? null,
        driverName: data.driverName ?? null,
        driverPhone: data.driverPhone ?? null,
        status: 'SCHEDULED',
      },
      include: {
        warehouse: true,
        receipt: true,
      },
    });
  }

  async findAppointments(
    filter: {
      warehouseId?: string;
      dockCode?: string;
      status?: AppointmentStatus;
      from?: Date;
      to?: Date;
    },
    pagination: PaginationParams,
    tx: Prisma.TransactionClient,
  ) {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.DockAppointmentWhereInput = {
      ...(filter.warehouseId && { warehouseId: filter.warehouseId }),
      ...(filter.dockCode && { dockCode: filter.dockCode }),
      ...(filter.status && { status: filter.status }),
      ...(filter.from &&
        filter.to && {
          scheduledAt: {
            gte: filter.from,
            lte: filter.to,
          },
        }),
    };

    const [appointments, total] = await Promise.all([
      tx.dockAppointment.findMany({
        where,
        include: {
          warehouse: true,
          receipt: true,
        },
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit,
      }),
      tx.dockAppointment.count({ where }),
    ]);

    return { appointments, total };
  }

  async findAppointmentById(
    appointmentId: string,
    tx: Prisma.TransactionClient,
  ) {
    return tx.dockAppointment.findUnique({
      where: { id: appointmentId },
      include: {
        warehouse: true,
        receipt: true,
      },
    });
  }

  async updateAppointment(
    appointmentId: string,
    data: Partial<{
      dockCode: string;
      scheduledAt: Date;
      durationMinutes: number;
      carrierName: string;
      vehicleRef: string;
      driverName: string;
      driverPhone: string;
      status: AppointmentStatus;
      receiptId: string | null;
      checkedInAt: Date | null;
      checkedOutAt: Date | null;
    }>,
    tx: Prisma.TransactionClient,
  ) {
    return tx.dockAppointment.update({
      where: { id: appointmentId },
      data,
    });
  }

  async deleteAppointment(appointmentId: string, tx: Prisma.TransactionClient) {
    return tx.dockAppointment.delete({
      where: { id: appointmentId },
    });
  }
}
