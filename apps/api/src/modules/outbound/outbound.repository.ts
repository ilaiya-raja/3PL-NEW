import { Injectable } from '@nestjs/common';
import {
  Prisma,
  OrderStatus,
  WaveStatus,
  PickTaskStatus,
} from '@wms/db';
import type { PaginationParams } from '../../common/utils/pagination';
import type { AllocationStrategy } from '@wms/types';

export interface FindOrdersFilter {
  clientId: string;
  status?: OrderStatus;
  warehouseId?: string;
}

export interface FindWavesFilter {
  warehouseId?: string;
  status?: WaveStatus;
}

export interface FindPickTasksFilter {
  warehouseId?: string;
  status?: PickTaskStatus;
  waveId?: string;
  assignedTo?: string;
}

export interface InventoryLotForAllocation {
  id: string;
  itemId: string;
  qtyOnHand: Prisma.Decimal;
  qtyAllocated: Prisma.Decimal;
  expiryDate: Date | null;
  receivedAt: Date;
  locationId: string | null;
}

@Injectable()
export class OutboundRepository {
  // ==================== ORDER CRUD ====================

  async createOrder(
    data: {
      clientId: string;
      warehouseId: string;
      externalRef: string;
      shipTo: object;
      billTo?: object;
      priority?: number;
      slaShipBy?: Date;
      notes?: string;
      lines: Array<{
        itemId: string;
        orderedQty: string;
        requestedLotNumber?: string;
      }>;
    },
    tx: Prisma.TransactionClient,
  ) {
    return tx.outboundOrder.create({
      data: {
        clientId: data.clientId,
        warehouseId: data.warehouseId,
        externalRef: data.externalRef,
        shipTo: data.shipTo as Prisma.InputJsonValue,
        billTo: (data.billTo as Prisma.InputJsonValue) ?? null,
        priority: data.priority ?? 5,
        slaShipBy: data.slaShipBy ?? null,
        notes: data.notes ?? null,
        status: 'RECEIVED',
        lines: {
          create: data.lines.map((line) => ({
            clientId: data.clientId,
            itemId: line.itemId,
            orderedQty: line.orderedQty,
            requestedLotNumber: line.requestedLotNumber ?? null,
          })),
        },
      },
      include: {
        lines: { include: { item: true } },
        warehouse: true,
      },
    });
  }

  async findOrderByExternalRef(
    clientId: string,
    externalRef: string,
    tx: Prisma.TransactionClient,
  ) {
    return tx.outboundOrder.findUnique({
      where: {
        clientId_externalRef: {
          clientId,
          externalRef,
        },
      },
      include: {
        lines: { include: { item: true, allocations: true } },
        warehouse: true,
        cartons: { include: { lines: true } },
        shipments: true,
      },
    });
  }

  async findOrders(
    filter: FindOrdersFilter,
    pagination: PaginationParams,
    tx: Prisma.TransactionClient,
  ) {
    const { clientId, status, warehouseId } = filter;
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;

    const where: Prisma.OutboundOrderWhereInput = {
      clientId,
      ...(status && { status }),
      ...(warehouseId && { warehouseId }),
    };

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      tx.outboundOrder.findMany({
        where,
        select: {
          id: true,
          clientId: true,
          externalRef: true,
          status: true,
          priority: true,
          slaShipBy: true,
          waveId: true,
          shipTo: true,
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
      tx.outboundOrder.count({ where }),
    ]);

    return { orders, total };
  }

  async findOrderById(orderId: string, tx: Prisma.TransactionClient) {
    return tx.outboundOrder.findUnique({
      where: { id: orderId },
      include: {
        warehouse: true,
        lines: {
          include: {
            item: true,
            allocations: { include: { lot: true } },
          },
        },
        cartons: { include: { lines: { include: { item: true, lot: true } } } },
        shipments: true,
        wave: true,
      },
    });
  }

  async updateOrder(
    orderId: string,
    data: {
      shipTo?: object;
      billTo?: object | null;
      priority?: number;
      slaShipBy?: Date | null;
      notes?: string | null;
      status?: OrderStatus;
      cancelledAt?: Date;
      cancelReason?: string;
    },
    tx: Prisma.TransactionClient,
  ) {
    return tx.outboundOrder.update({
      where: { id: orderId },
      data: {
        ...(data.shipTo && { shipTo: data.shipTo as Prisma.InputJsonValue }),
        ...(data.billTo !== undefined && { billTo: data.billTo as Prisma.InputJsonValue }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.slaShipBy !== undefined && { slaShipBy: data.slaShipBy }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.status && { status: data.status }),
        ...(data.cancelledAt && { cancelledAt: data.cancelledAt }),
        ...(data.cancelReason && { cancelReason: data.cancelReason }),
      },
      include: {
        lines: { include: { item: true, allocations: true } },
        warehouse: true,
      },
    });
  }

  // ==================== ALLOCATION ====================

  async findLotsForAllocation(
    clientId: string,
    itemId: string,
    strategy: AllocationStrategy,
    tx: Prisma.TransactionClient,
  ): Promise<InventoryLotForAllocation[]> {
    return tx.$queryRaw<InventoryLotForAllocation[]>`
      SELECT id, item_id as "itemId", qty_on_hand as "qtyOnHand", 
             qty_allocated as "qtyAllocated", expiry_date as "expiryDate", 
             received_at as "receivedAt", location_id as "locationId"
      FROM inventory_lot
      WHERE client_id = ${clientId}::uuid
        AND item_id = ${itemId}::uuid
        AND status = 'AVAILABLE'
        AND qty_on_hand - qty_allocated > 0
      ORDER BY ${strategy === 'FEFO' ? Prisma.sql`expiry_date ASC NULLS LAST, received_at ASC` : Prisma.sql`received_at ASC`}
      FOR UPDATE SKIP LOCKED
    `;
  }

  async createAllocation(
    data: {
      clientId: string;
      lineId: string;
      lotId: string;
      qty: string;
    },
    tx: Prisma.TransactionClient,
  ) {
    return tx.allocation.create({
      data: {
        clientId: data.clientId,
        lineId: data.lineId,
        lotId: data.lotId,
        qty: data.qty,
      },
    });
  }

  async updateLotAllocation(
    lotId: string,
    qtyAllocatedDelta: string,
    tx: Prisma.TransactionClient,
  ) {
    return tx.inventoryLot.update({
      where: { id: lotId },
      data: {
        qtyAllocated: {
          increment: qtyAllocatedDelta,
        },
      },
    });
  }

  async deleteAllocationsForLine(lineId: string, tx: Prisma.TransactionClient) {
    return tx.allocation.deleteMany({
      where: { lineId },
    });
  }

  async findAllocationsForOrder(orderId: string, tx: Prisma.TransactionClient) {
    return tx.allocation.findMany({
      where: {
        line: { orderId },
      },
      include: {
        lot: true,
        line: true,
      },
    });
  }

  async updateLineBackorderedQty(
    lineId: string,
    backorderedQty: string,
    tx: Prisma.TransactionClient,
  ) {
    return tx.outboundLine.update({
      where: { id: lineId },
      data: { backorderedQty },
    });
  }

  // ==================== WAVE ====================

  async createWave(
    data: {
      warehouseId: string;
      name: string;
      createdBy: string;
      orderIds: string[];
    },
    tx: Prisma.TransactionClient,
  ) {
    const wave = await tx.wave.create({
      data: {
        warehouseId: data.warehouseId,
        name: data.name,
        createdBy: data.createdBy,
        status: 'PLANNING',
      },
    });

    await tx.outboundOrder.updateMany({
      where: { id: { in: data.orderIds } },
      data: { waveId: wave.id },
    });

    return wave;
  }

  async findWaves(
    filter: FindWavesFilter,
    pagination: PaginationParams,
    tx: Prisma.TransactionClient,
  ) {
    const { warehouseId, status } = filter;
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;

    const where: Prisma.WaveWhereInput = {
      ...(warehouseId && { warehouseId }),
      ...(status && { status }),
    };

    const skip = (page - 1) * limit;

    const [waves, total] = await Promise.all([
      tx.wave.findMany({
        where,
        include: {
          warehouse: true,
          orders: { include: { lines: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      tx.wave.count({ where }),
    ]);

    return { waves, total };
  }

  async findWaveById(waveId: string, tx: Prisma.TransactionClient) {
    return tx.wave.findUnique({
      where: { id: waveId },
      include: {
        warehouse: true,
        orders: {
          include: {
            lines: {
              include: {
                item: true,
                allocations: { include: { lot: true } },
              },
            },
          },
        },
        pickTasks: {
          include: {
            item: true,
            lot: true,
            line: true,
          },
        },
      },
    });
  }

  async updateWaveStatus(
    waveId: string,
    status: WaveStatus,
    tx: Prisma.TransactionClient,
  ) {
    const updateData: Prisma.WaveUpdateInput = { status };
    if (status === 'RELEASED') {
      updateData.releasedAt = new Date();
    } else if (status === 'COMPLETE') {
      updateData.completedAt = new Date();
    }

    return tx.wave.update({
      where: { id: waveId },
      data: updateData,
    });
  }

  // ==================== PICK TASK ====================

  async createPickTask(
    data: {
      waveId?: string;
      orderId: string;
      lineId: string;
      lotId: string;
      fromLocationId: string;
      itemId: string;
      clientId: string;
      qtyToPick: string;
      pickSequence: number;
    },
    tx: Prisma.TransactionClient,
  ) {
    return tx.pickTask.create({
      data: {
        waveId: data.waveId ?? null,
        orderId: data.orderId,
        lineId: data.lineId,
        lotId: data.lotId,
        fromLocationId: data.fromLocationId,
        itemId: data.itemId,
        clientId: data.clientId,
        qtyToPick: data.qtyToPick,
        pickSequence: data.pickSequence,
        status: 'OPEN',
      },
    });
  }

  async findPickTasks(
    filter: FindPickTasksFilter,
    pagination: PaginationParams,
    tx: Prisma.TransactionClient,
  ) {
    const { warehouseId, status, waveId, assignedTo } = filter;
    const { page, limit, sortBy = 'pickSequence', sortOrder = 'asc' } = pagination;

    const where: Prisma.PickTaskWhereInput = {
      ...(status && { status }),
      ...(waveId && { waveId }),
      ...(assignedTo && { assignedTo }),
      ...(warehouseId && { order: { warehouseId } }),
    };

    const skip = (page - 1) * limit;

    const [tasks, total] = await Promise.all([
      tx.pickTask.findMany({
        where,
        include: {
          order: true,
          line: { include: { item: true } },
          lot: true,
          item: true,
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      tx.pickTask.count({ where }),
    ]);

    return { tasks, total };
  }

  async findPickTaskById(taskId: string, tx: Prisma.TransactionClient) {
    return tx.pickTask.findUnique({
      where: { id: taskId },
      include: {
        order: true,
        line: { include: { item: true } },
        lot: true,
        item: true,
        wave: true,
      },
    });
  }

  async updatePickTask(
    taskId: string,
    data: {
      qtyPicked?: string;
      status?: PickTaskStatus;
      completedAt?: Date;
      assignedTo?: string | null;
    },
    tx: Prisma.TransactionClient,
  ) {
    return tx.pickTask.update({
      where: { id: taskId },
      data: {
        ...(data.qtyPicked !== undefined && { qtyPicked: data.qtyPicked }),
        ...(data.status && { status: data.status }),
        ...(data.completedAt && { completedAt: data.completedAt }),
        ...(data.assignedTo !== undefined && { assignedTo: data.assignedTo }),
      },
    });
  }

  async updateLinePickedQty(
    lineId: string,
    pickedQtyDelta: string,
    tx: Prisma.TransactionClient,
  ) {
    return tx.outboundLine.update({
      where: { id: lineId },
      data: {
        pickedQty: {
          increment: pickedQtyDelta,
        },
      },
    });
  }

  async updateLotQuantities(
    lotId: string,
    data: {
      qtyAllocatedDelta?: string;
      qtyOnHandDelta?: string;
    },
    tx: Prisma.TransactionClient,
  ) {
    const updateData: Prisma.InventoryLotUpdateInput = {};

    if (data.qtyAllocatedDelta !== undefined) {
      updateData.qtyAllocated = { decrement: data.qtyAllocatedDelta };
    }
    if (data.qtyOnHandDelta !== undefined) {
      updateData.qtyOnHand = { decrement: data.qtyOnHandDelta };
    }

    return tx.inventoryLot.update({
      where: { id: lotId },
      data: updateData,
    });
  }

  // ==================== CARTON ====================

  async createCarton(
    data: {
      orderId: string;
      clientId: string;
      cartonNo: string;
      dims?: object;
    },
    tx: Prisma.TransactionClient,
  ) {
    return tx.carton.create({
      data: {
        orderId: data.orderId,
        clientId: data.clientId,
        cartonNo: data.cartonNo,
        dims: (data.dims as Prisma.InputJsonValue) ?? null,
        status: 'OPEN',
      },
      include: {
        lines: { include: { item: true, lot: true } },
      },
    });
  }

  async findCartonById(cartonId: string, tx: Prisma.TransactionClient) {
    return tx.carton.findUnique({
      where: { id: cartonId },
      include: {
        order: true,
        lines: { include: { item: true, lot: true } },
      },
    });
  }

  async addCartonLine(
    data: {
      clientId: string;
      cartonId: string;
      itemId: string;
      lotId: string;
      qty: string;
    },
    tx: Prisma.TransactionClient,
  ) {
    return tx.cartonLine.create({
      data: {
        clientId: data.clientId,
        cartonId: data.cartonId,
        itemId: data.itemId,
        lotId: data.lotId,
        qty: data.qty,
      },
    });
  }

  async closeCarton(cartonId: string, tx: Prisma.TransactionClient) {
    return tx.carton.update({
      where: { id: cartonId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
      },
    });
  }

  async findCartonsForOrder(orderId: string, tx: Prisma.TransactionClient) {
    return tx.carton.findMany({
      where: { orderId },
      include: {
        lines: { include: { item: true, lot: true } },
      },
    });
  }

  // ==================== SHIPMENT ====================

  async createShipment(
    data: {
      orderId: string;
      clientId: string;
      carrierName?: string;
      trackingNumber?: string;
      ewayBillNo?: string;
      shipDate?: Date;
    },
    tx: Prisma.TransactionClient,
  ) {
    return tx.shipment.create({
      data: {
        orderId: data.orderId,
        clientId: data.clientId,
        carrierName: data.carrierName ?? null,
        trackingNumber: data.trackingNumber ?? null,
        ewayBillNo: data.ewayBillNo ?? null,
        shipDate: data.shipDate ?? new Date(),
        status: 'CREATED',
      },
    });
  }

  async findItemById(itemId: string, tx: Prisma.TransactionClient) {
    return tx.item.findUnique({
      where: { id: itemId },
    });
  }

  async findClientById(clientId: string, tx: Prisma.TransactionClient) {
    return tx.client.findUnique({
      where: { id: clientId },
    });
  }
}
