import { Injectable } from '@nestjs/common';
import { Prisma, LotStatus, HoldType, AdjustmentStatus } from '@wms/db';
import type { PaginationParams } from '../../common/utils/pagination';

export interface FindLotsFilter {
  clientId?: string;
  warehouseId?: string;
  itemId?: string;
  status?: LotStatus;
  lotNumber?: string;
  lpn?: string;
  search?: string;
}

const LOT_LIST_SELECT = {
  id: true,
  clientId: true,
  lotNumber: true,
  lpn: true,
  qtyOnHand: true,
  qtyAllocated: true,
  status: true,
  expiryDate: true,
  receivedAt: true,
  item: {
    select: {
      sku: true,
      description: true,
    },
  },
  warehouse: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  location: {
    select: {
      code: true,
    },
  },
  client: {
    select: {
      id: true,
      code: true,
      legalName: true,
    },
  },
} satisfies Prisma.InventoryLotSelect;

export type InventoryLotListRow = Prisma.InventoryLotGetPayload<{
  select: typeof LOT_LIST_SELECT;
}>;

@Injectable()
export class InventoryRepository {
  async findLots(
    filter: FindLotsFilter,
    pagination: PaginationParams,
    tx: Prisma.TransactionClient,
  ) {
    const { clientId, warehouseId, itemId, status, lotNumber, lpn, search } =
      filter;
    const { page, limit, sortBy = 'receivedAt', sortOrder } = pagination;

    const where: Prisma.InventoryLotWhereInput = {
      ...(clientId && { clientId }),
      ...(warehouseId && { warehouseId }),
      ...(itemId && { itemId }),
      ...(status && { status }),
      ...(lotNumber && { lotNumber: { contains: lotNumber, mode: 'insensitive' } }),
      ...(lpn && { lpn: { contains: lpn, mode: 'insensitive' } }),
      ...(search && {
        OR: [
          { lotNumber: { contains: search, mode: 'insensitive' } },
          { lpn: { contains: search, mode: 'insensitive' } },
          { item: { sku: { contains: search, mode: 'insensitive' } } },
          { item: { description: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const skip = (page - 1) * limit;

    const [lots, total] = await Promise.all([
      tx.inventoryLot.findMany({
        where,
        select: LOT_LIST_SELECT,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      tx.inventoryLot.count({ where }),
    ]);

    return { lots, total };
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

  async findLotsByItem(
    clientId: string,
    itemId: string,
    tx: Prisma.TransactionClient,
  ) {
    return tx.inventoryLot.findMany({
      where: { clientId, itemId },
      include: {
        location: true,
        warehouse: true,
      },
      orderBy: { expiryDate: 'asc' },
    });
  }

  async findTransactionsByLot(
    lotId: string,
    pagination: PaginationParams,
    tx: Prisma.TransactionClient,
  ) {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      tx.inventoryTransaction.findMany({
        where: { lotId },
        orderBy: { occurredAt: 'desc' },
        skip,
        take: limit,
      }),
      tx.inventoryTransaction.count({ where: { lotId } }),
    ]);

    return { transactions, total };
  }

  async createHold(
    data: {
      clientId: string;
      itemId?: string;
      lotId?: string;
      locationId?: string;
      holdType: HoldType;
      reason: string;
      heldBy: string;
    },
    tx: Prisma.TransactionClient,
  ) {
    return tx.inventoryHold.create({
      data: {
        clientId: data.clientId,
        itemId: data.itemId ?? null,
        lotId: data.lotId ?? null,
        locationId: data.locationId ?? null,
        holdType: data.holdType,
        reason: data.reason,
        heldBy: data.heldBy,
        active: true,
      },
    });
  }

  async findHolds(
    clientId: string,
    filter: { active?: boolean; holdType?: HoldType },
    pagination: PaginationParams,
    tx: Prisma.TransactionClient,
  ) {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryHoldWhereInput = {
      clientId,
      ...(filter.active !== undefined && { active: filter.active }),
      ...(filter.holdType && { holdType: filter.holdType }),
    };

    const [holds, total] = await Promise.all([
      tx.inventoryHold.findMany({
        where,
        include: {
          item: true,
          lot: { include: { item: true, location: true } },
          location: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      tx.inventoryHold.count({ where }),
    ]);

    return { holds, total };
  }

  async findHoldById(holdId: string, tx: Prisma.TransactionClient) {
    return tx.inventoryHold.findUnique({
      where: { id: holdId },
      include: {
        item: true,
        lot: { include: { item: true } },
        location: true,
      },
    });
  }

  async releaseHold(
    holdId: string,
    releasedBy: string,
    tx: Prisma.TransactionClient,
  ) {
    return tx.inventoryHold.update({
      where: { id: holdId },
      data: {
        active: false,
        releasedBy,
        releasedAt: new Date(),
      },
    });
  }

  async findAffectedLotsByHold(
    clientId: string,
    filter: {
      itemId?: string;
      lotId?: string;
      locationId?: string;
    },
    tx: Prisma.TransactionClient,
  ) {
    const where: Prisma.InventoryLotWhereInput = {
      clientId,
      status: { in: ['AVAILABLE', 'RECEIVED'] },
    };

    if (filter.lotId) {
      where.id = filter.lotId;
    } else if (filter.itemId && filter.locationId) {
      where.itemId = filter.itemId;
      where.locationId = filter.locationId;
    } else if (filter.itemId) {
      where.itemId = filter.itemId;
    } else if (filter.locationId) {
      where.locationId = filter.locationId;
    }

    return tx.inventoryLot.findMany({
      where,
      include: {
        allocations: {
          include: {
            line: {
              include: {
                order: true,
              },
            },
          },
        },
      },
    });
  }

  async updateLotStatus(
    lotId: string,
    status: LotStatus,
    tx: Prisma.TransactionClient,
  ) {
    return tx.inventoryLot.update({
      where: { id: lotId },
      data: { status },
    });
  }

  async deallocateLot(lotId: string, tx: Prisma.TransactionClient) {
    const allocations = await tx.allocation.findMany({
      where: { lotId },
      include: { line: { include: { order: true } } },
    });

    for (const allocation of allocations) {
      // Restore qty_allocated
      await tx.inventoryLot.update({
        where: { id: lotId },
        data: {
          qtyAllocated: {
            decrement: allocation.qty,
          },
        },
      });

      // Delete allocation
      await tx.allocation.delete({
        where: { id: allocation.id },
      });

      // Update order status to BACKORDERED if it was ALLOCATED or RECEIVED
      const order = allocation.line.order;
      if (order.status === 'ALLOCATED' || order.status === 'RECEIVED') {
        await tx.outboundOrder.update({
          where: { id: order.id },
          data: { status: 'BACKORDERED' },
        });
      }
    }

    return allocations;
  }

  async createAdjustment(
    data: {
      clientId: string;
      itemId: string;
      lotId: string;
      locationId?: string | null;
      qtyDelta: string;
      reasonCode: string;
      notes?: string;
      status: AdjustmentStatus;
      requestedBy: string;
      approvedBy?: string;
    },
    tx: Prisma.TransactionClient,
  ) {
    return tx.adjustment.create({
      data: {
        clientId: data.clientId,
        itemId: data.itemId,
        lotId: data.lotId,
        locationId: data.locationId ?? null,
        qtyDelta: data.qtyDelta,
        reasonCode: data.reasonCode,
        notes: data.notes ?? null,
        status: data.status,
        requestedBy: data.requestedBy,
        approvedBy: data.approvedBy ?? null,
        ...(data.status === 'APPROVED' && { approvedAt: new Date() }),
      },
    });
  }

  async findAdjustments(
    clientId: string,
    filter: { status?: AdjustmentStatus },
    pagination: PaginationParams,
    tx: Prisma.TransactionClient,
  ) {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.AdjustmentWhereInput = {
      clientId,
      ...(filter.status && { status: filter.status }),
    };

    const [adjustments, total] = await Promise.all([
      tx.adjustment.findMany({
        where,
        include: {
          item: true,
          lot: { include: { location: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      tx.adjustment.count({ where }),
    ]);

    return { adjustments, total };
  }

  async findAdjustmentById(adjustmentId: string, tx: Prisma.TransactionClient) {
    return tx.adjustment.findUnique({
      where: { id: adjustmentId },
      include: {
        item: true,
        lot: { include: { location: true } },
      },
    });
  }

  async updateAdjustmentStatus(
    adjustmentId: string,
    status: AdjustmentStatus,
    actorId: string,
    tx: Prisma.TransactionClient,
  ) {
    const data: Prisma.AdjustmentUpdateInput = {
      status,
      ...(status === 'APPROVED' && {
        approvedBy: actorId,
        approvedAt: new Date(),
      }),
      ...(status === 'REJECTED' && {
        rejectedBy: actorId,
      }),
    };

    return tx.adjustment.update({
      where: { id: adjustmentId },
      data,
    });
  }

  async updateLotQuantity(
    lotId: string,
    qtyDelta: string,
    tx: Prisma.TransactionClient,
  ) {
    const lot = await tx.inventoryLot.findUnique({
      where: { id: lotId },
    });

    if (!lot) {
      throw new Error('Lot not found');
    }

    return tx.inventoryLot.update({
      where: { id: lotId },
      data: {
        qtyOnHand: {
          increment: qtyDelta,
        },
      },
    });
  }

  async findClientById(clientId: string, tx: Prisma.TransactionClient) {
    return tx.client.findUnique({
      where: { id: clientId },
    });
  }
}
