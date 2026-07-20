import { HttpStatus, Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma, OrderStatus, PickTaskStatus } from '@wms/db';
import { ErrorCodes, TxnType, AllocationStrategy } from '@wms/types';
import type {
  CreateOrderInput,
  UpdateOrderInput,
  CancelOrderInput,
  CreateWaveInput,
  ConfirmPickInput,
  CreateCartonInput,
  AddCartonLineInput,
  ShipConfirmInput,
} from '@wms/zod-schemas';
import { TenantPrismaService } from '../../database/tenant-prisma.service';
import { WmsException } from '../../common/exceptions/wms.exception';
import type { PaginationParams } from '../../common/utils/pagination';
import { calculatePagination } from '../../common/utils/pagination';
import { OutboundRepository } from './outbound.repository';
import { InventoryTransactionService } from '../inventory/inventory-transaction.service';

interface AllocationResult {
  allocated: boolean;
  shortfall: string;
}

@Injectable()
export class OutboundService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly repository: OutboundRepository,
    private readonly transactionService: InventoryTransactionService,
  ) {}

  // ==================== ORDER CRUD ====================

  async createOrder(
    clientId: string,
    input: CreateOrderInput,
    useOpsRole = false,
  ) {
    const txFn = async (tx: Prisma.TransactionClient) => {
      // Check for existing order with same externalRef (idempotency)
      const existing = await this.repository.findOrderByExternalRef(
        clientId,
        input.externalRef,
        tx,
      );

      if (existing) {
        return existing;
      }

      const order = await this.repository.createOrder(
        {
          clientId,
          warehouseId: input.warehouseId,
          externalRef: input.externalRef,
          shipTo: input.shipTo,
          billTo: input.billTo,
          priority: input.priority,
          slaShipBy: input.slaShipBy ? new Date(input.slaShipBy) : undefined,
          notes: input.notes,
          lines: input.lines.map((line) => ({
            itemId: line.itemId,
            orderedQty: line.orderedQty.toString(),
            requestedLotNumber: line.requestedLotNumber,
          })),
        },
        tx,
      );

      return order;
    };

    if (useOpsRole) {
      return this.tenantPrisma.withOpsRole(txFn);
    } else {
      return this.tenantPrisma.withTenant(clientId, txFn);
    }
  }

  async listOrders(
    clientId: string,
    filter: { status?: OrderStatus; warehouseId?: string },
    pagination: PaginationParams,
    useOpsRole = false,
  ) {
    const txFn = async (tx: Prisma.TransactionClient) => {
      const { orders, total } = await this.repository.findOrders(
        {
          clientId,
          status: filter.status,
          warehouseId: filter.warehouseId,
        },
        pagination,
        tx,
      );

      return {
        data: orders,
        pagination: calculatePagination(pagination.page, pagination.limit, total),
      };
    };

    if (useOpsRole) {
      return this.tenantPrisma.withOpsRole(txFn);
    } else {
      return this.tenantPrisma.withTenant(clientId, txFn);
    }
  }

  async getOrder(clientId: string, orderId: string, useOpsRole = false) {
    const txFn = async (tx: Prisma.TransactionClient) => {
      const order = await this.repository.findOrderById(orderId, tx);

      if (!order || order.clientId !== clientId) {
        throw new WmsException(
          ErrorCodes.ORD_NOT_FOUND,
          'Order not found',
          HttpStatus.NOT_FOUND,
        );
      }

      return order;
    };

    if (useOpsRole) {
      return this.tenantPrisma.withOpsRole(txFn);
    } else {
      return this.tenantPrisma.withTenant(clientId, txFn);
    }
  }

  async updateOrder(
    clientId: string,
    orderId: string,
    input: UpdateOrderInput,
    useOpsRole = false,
  ) {
    const txFn = async (tx: Prisma.TransactionClient) => {
      const order = await this.repository.findOrderById(orderId, tx);

      if (!order || order.clientId !== clientId) {
        throw new WmsException(
          ErrorCodes.ORD_NOT_FOUND,
          'Order not found',
          HttpStatus.NOT_FOUND,
        );
      }

      // Only allow updates before RELEASED
      if (
        order.status !== 'RECEIVED' &&
        order.status !== 'VALIDATED' &&
        order.status !== 'ALLOCATED' &&
        order.status !== 'BACKORDERED'
      ) {
        throw new WmsException(
          ErrorCodes.ORD_INVALID_STATUS,
          'Cannot update order after it has been released',
          HttpStatus.BAD_REQUEST,
        );
      }

      return this.repository.updateOrder(
        orderId,
        {
          shipTo: input.shipTo,
          billTo: input.billTo,
          priority: input.priority,
          slaShipBy: input.slaShipBy ? new Date(input.slaShipBy) : null,
          notes: input.notes,
        },
        tx,
      );
    };

    if (useOpsRole) {
      return this.tenantPrisma.withOpsRole(txFn);
    } else {
      return this.tenantPrisma.withTenant(clientId, txFn);
    }
  }

  async cancelOrder(
    clientId: string,
    orderId: string,
    input: CancelOrderInput,
    useOpsRole = false,
  ) {
    const txFn = async (tx: Prisma.TransactionClient) => {
      const order = await this.repository.findOrderById(orderId, tx);

      if (!order || order.clientId !== clientId) {
        throw new WmsException(
          ErrorCodes.ORD_NOT_FOUND,
          'Order not found',
          HttpStatus.NOT_FOUND,
        );
      }

      // Only allow cancellation before RELEASED
      if (
        order.status !== 'RECEIVED' &&
        order.status !== 'VALIDATED' &&
        order.status !== 'ALLOCATED' &&
        order.status !== 'BACKORDERED'
      ) {
        throw new WmsException(
          ErrorCodes.ORD_INVALID_STATUS,
          'Cannot cancel order after it has been released',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Deallocate any existing allocations
      const allocations = await this.repository.findAllocationsForOrder(
        orderId,
        tx,
      );

      for (const allocation of allocations) {
        // Decrease lot's qtyAllocated
        await this.repository.updateLotAllocation(
          allocation.lotId,
          new Decimal(allocation.qty).negated().toString(),
          tx,
        );

        // Write ledger entry
        await this.transactionService.writeLedger(
          {
            clientId,
            txnType: TxnType.DEALLOCATE,
            itemId: allocation.line.itemId,
            lotId: allocation.lotId,
            qtyDelta: '0',
            refType: 'OutboundOrder',
            refId: orderId,
            notes: `Deallocated ${allocation.qty} units due to order cancellation`,
          },
          tx,
        );
      }

      // Delete allocations
      for (const line of order.lines) {
        await this.repository.deleteAllocationsForLine(line.id, tx);
      }

      // Update order status
      return this.repository.updateOrder(
        orderId,
        {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: input.cancelReason,
        },
        tx,
      );
    };

    if (useOpsRole) {
      return this.tenantPrisma.withOpsRole(txFn);
    } else {
      return this.tenantPrisma.withTenant(clientId, txFn);
    }
  }

  // ==================== ALLOCATION ====================

  async allocateOrder(clientId: string, orderId: string) {
    return this.tenantPrisma.withTenant(clientId, async (tx) => {
      const order = await this.repository.findOrderById(orderId, tx);

      if (!order || order.clientId !== clientId) {
        throw new WmsException(
          ErrorCodes.ORD_NOT_FOUND,
          'Order not found',
          HttpStatus.NOT_FOUND,
        );
      }

      // Get client config for allocation strategy
      const client = await this.repository.findClientById(clientId, tx);
      const config = (client?.config as any) || {};
      const strategy: AllocationStrategy =
        config.allocationStrategy || 'FEFO';

      let hasBackorder = false;

      for (const line of order.lines) {
        const result = await this.allocateLine(
          clientId,
          line,
          strategy,
          tx,
        );

        if (!result.allocated) {
          hasBackorder = true;
          await this.repository.updateLineBackorderedQty(
            line.id,
            result.shortfall,
            tx,
          );
        }
      }

      // Update order status
      const newStatus: OrderStatus = hasBackorder ? 'BACKORDERED' : 'ALLOCATED';
      await this.repository.updateOrder(orderId, { status: newStatus }, tx);

      return this.repository.findOrderById(orderId, tx);
    });
  }

  private async allocateLine(
    clientId: string,
    line: any,
    strategy: AllocationStrategy,
    tx: Prisma.TransactionClient,
  ): Promise<AllocationResult> {
    const orderedQty = new Decimal(line.orderedQty);
    let remainingQty = orderedQty;

    // Get item for shelf life rules
    const item = await this.repository.findItemById(line.itemId, tx);

    if (!item) {
      throw new WmsException(
        ErrorCodes.ITEM_NOT_FOUND,
        `Item ${line.itemId} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    // Find available lots using the allocation strategy
    const lots = await this.repository.findLotsForAllocation(
      clientId,
      line.itemId,
      strategy,
      tx,
    );

    for (const lot of lots) {
      if (remainingQty.lte(0)) break;

      // Check shelf life constraints
      if (!this.lotPassesShelfLife(lot, item)) {
        continue;
      }

      // Calculate available quantity in this lot
      const available = new Decimal(lot.qtyOnHand.toString()).minus(
        new Decimal(lot.qtyAllocated.toString()),
      );

      if (available.lte(0)) continue;

      // Allocate from this lot
      const qtyToAllocate = Decimal.min(remainingQty, available);

      // Create allocation record
      await this.repository.createAllocation(
        {
          clientId,
          lineId: line.id,
          lotId: lot.id,
          qty: qtyToAllocate.toString(),
        },
        tx,
      );

      // Update lot's allocated quantity
      await this.repository.updateLotAllocation(
        lot.id,
        qtyToAllocate.toString(),
        tx,
      );

      // Write ledger entry
      await this.transactionService.writeLedger(
        {
          clientId,
          txnType: TxnType.ALLOCATE,
          itemId: line.itemId,
          lotId: lot.id,
          qtyDelta: '0',
          refType: 'OutboundLine',
          refId: line.id,
          notes: `Allocated ${qtyToAllocate} units`,
        },
        tx,
      );

      remainingQty = remainingQty.minus(qtyToAllocate);
    }

    const allocated = remainingQty.lte(0);
    return {
      allocated,
      shortfall: remainingQty.toString(),
    };
  }

  private lotPassesShelfLife(lot: any, item: any): boolean {
    if (!item.shelfLifeDays || !item.minShipShelfPct || !lot.expiryDate) {
      return true;
    }

    const now = new Date();
    const expiryDate = new Date(lot.expiryDate);

    const totalShelfLifeMs = item.shelfLifeDays * 24 * 60 * 60 * 1000;
    const remainingMs = expiryDate.getTime() - now.getTime();
    const remainingPct = (remainingMs / totalShelfLifeMs) * 100;

    return remainingPct >= parseFloat(item.minShipShelfPct.toString());
  }

  // ==================== WAVE ====================

  async createWave(input: CreateWaveInput, createdBy: string) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      // Validate all orders exist and are in valid status
      for (const orderId of input.orderIds) {
        const order = await this.repository.findOrderById(orderId, tx);
        if (!order) {
          throw new WmsException(
            ErrorCodes.ORD_NOT_FOUND,
            `Order ${orderId} not found`,
            HttpStatus.NOT_FOUND,
          );
        }
        if (order.warehouseId !== input.warehouseId) {
          throw new WmsException(
            ErrorCodes.ORD_INVALID_STATUS,
            `Order ${orderId} belongs to different warehouse`,
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      const wave = await this.repository.createWave(
        {
          warehouseId: input.warehouseId,
          name: input.name,
          createdBy,
          orderIds: input.orderIds,
        },
        tx,
      );

      return this.repository.findWaveById(wave.id, tx);
    });
  }

  async listWaves(
    filter: { warehouseId?: string; status?: string },
    pagination: PaginationParams,
  ) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const { waves, total } = await this.repository.findWaves(
        {
          warehouseId: filter.warehouseId,
          status: filter.status as any,
        },
        pagination,
        tx,
      );

      return {
        data: waves,
        pagination: calculatePagination(pagination.page, pagination.limit, total),
      };
    });
  }

  async getWave(waveId: string) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const wave = await this.repository.findWaveById(waveId, tx);

      if (!wave) {
        throw new WmsException(
          ErrorCodes.ORD_NOT_FOUND,
          'Wave not found',
          HttpStatus.NOT_FOUND,
        );
      }

      return wave;
    });
  }

  async releaseWave(waveId: string) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const wave = await this.repository.findWaveById(waveId, tx);

      if (!wave) {
        throw new WmsException(
          ErrorCodes.ORD_NOT_FOUND,
          'Wave not found',
          HttpStatus.NOT_FOUND,
        );
      }

      if (wave.status !== 'PLANNING') {
        throw new WmsException(
          ErrorCodes.ORD_INVALID_STATUS,
          'Wave must be in PLANNING status to release',
          HttpStatus.BAD_REQUEST,
        );
      }

      let allocatedCount = 0;
      let backorderedCount = 0;

      for (const order of wave.orders) {
        // Allocate the order
        const client = await this.repository.findClientById(order.clientId, tx);
        const config = (client?.config as any) || {};
        const strategy: AllocationStrategy =
          config.allocationStrategy || 'FEFO';

        let hasBackorder = false;

        for (const line of order.lines) {
          const result = await this.allocateLine(
            order.clientId,
            line,
            strategy,
            tx,
          );

          if (!result.allocated) {
            hasBackorder = true;
            await this.repository.updateLineBackorderedQty(
              line.id,
              result.shortfall,
              tx,
            );
          }

          // Create pick tasks for allocated quantities
          const allocations = line.allocations || [];
          for (const allocation of allocations) {
            const lot = allocation.lot;
            const pickSequence = lot.locationId
              ? (
                  await tx.location.findUnique({
                    where: { id: lot.locationId },
                  })
                )?.pickSequence ?? 9999
              : 9999;

            await this.repository.createPickTask(
              {
                waveId: wave.id,
                orderId: order.id,
                lineId: line.id,
                lotId: allocation.lotId,
                fromLocationId: lot.locationId || '',
                itemId: line.itemId,
                clientId: order.clientId,
                qtyToPick: allocation.qty.toString(),
                pickSequence,
              },
              tx,
            );
          }
        }

        // Update order status
        const newStatus: OrderStatus = hasBackorder
          ? 'BACKORDERED'
          : 'RELEASED';
        await this.repository.updateOrder(order.id, { status: newStatus }, tx);

        if (hasBackorder) {
          backorderedCount++;
        } else {
          allocatedCount++;
        }
      }

      // Update wave status
      await this.repository.updateWaveStatus(wave.id, 'RELEASED', tx);

      return {
        waveId: wave.id,
        status: 'RELEASED',
        summary: {
          totalOrders: wave.orders.length,
          allocated: allocatedCount,
          backordered: backorderedCount,
        },
      };
    });
  }

  // ==================== PICK ====================

  async listPickTasks(
    filter: {
      warehouseId?: string;
      status?: PickTaskStatus;
      waveId?: string;
      assignedTo?: string;
    },
    pagination: PaginationParams,
  ) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const { tasks, total } = await this.repository.findPickTasks(
        filter,
        pagination,
        tx,
      );

      return {
        data: tasks,
        pagination: calculatePagination(pagination.page, pagination.limit, total),
      };
    });
  }

  async assignPick(taskId: string, assignedTo: string) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const task = await this.repository.findPickTaskById(taskId, tx);

      if (!task) {
        throw new WmsException(
          ErrorCodes.ORD_NOT_FOUND,
          'Pick task not found',
          HttpStatus.NOT_FOUND,
        );
      }

      if (task.status !== 'OPEN' && task.status !== 'IN_PROGRESS') {
        throw new WmsException(
          ErrorCodes.ORD_INVALID_STATUS,
          'Pick task cannot be assigned in current status',
          HttpStatus.BAD_REQUEST,
        );
      }

      return this.repository.updatePickTask(
        taskId,
        {
          assignedTo,
          status: task.status === 'OPEN' ? 'IN_PROGRESS' : task.status,
        },
        tx,
      );
    });
  }

  async confirmPick(taskId: string, input: ConfirmPickInput) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const task = await this.repository.findPickTaskById(taskId, tx);

      if (!task) {
        throw new WmsException(
          ErrorCodes.ORD_NOT_FOUND,
          'Pick task not found',
          HttpStatus.NOT_FOUND,
        );
      }

      if (task.status !== 'OPEN' && task.status !== 'IN_PROGRESS') {
        throw new WmsException(
          ErrorCodes.ORD_INVALID_STATUS,
          'Pick task is not in valid status for confirmation',
          HttpStatus.BAD_REQUEST,
        );
      }

      const qtyPicked = new Decimal(input.qtyPicked.toString());
      const qtyToPick = new Decimal(task.qtyToPick.toString());

      // Determine task status
      const newStatus: PickTaskStatus = qtyPicked.gte(qtyToPick)
        ? 'COMPLETE'
        : 'SHORT';

      // Update task
      await this.repository.updatePickTask(
        taskId,
        {
          qtyPicked: qtyPicked.toString(),
          status: newStatus,
          completedAt: new Date(),
        },
        tx,
      );

      // Update line's picked quantity
      await this.repository.updateLinePickedQty(task.lineId, qtyPicked.toString(), tx);

      // Update lot quantities (decrease allocated and on-hand)
      await this.repository.updateLotQuantities(
        task.lotId,
        {
          qtyAllocatedDelta: qtyPicked.toString(),
          qtyOnHandDelta: qtyPicked.toString(),
        },
        tx,
      );

      // Write ledger entry
      await this.transactionService.writeLedger(
        {
          clientId: task.clientId,
          txnType: TxnType.PICK,
          itemId: task.itemId,
          lotId: task.lotId,
          fromLocationId: task.fromLocationId,
          qtyDelta: qtyPicked.negated().toString(),
          refType: 'PickTask',
          refId: taskId,
          notes: `Picked ${qtyPicked} units`,
        },
        tx,
      );

      // If short, attempt re-allocation
      if (newStatus === 'SHORT') {
        const shortfall = qtyToPick.minus(qtyPicked);
        const line = await tx.outboundLine.findUnique({
          where: { id: task.lineId },
          include: { order: true, item: true },
        });

        if (line) {
          const client = await this.repository.findClientById(
            line.order.clientId,
            tx,
          );
          const config = (client?.config as any) || {};
          const strategy: AllocationStrategy =
            config.allocationStrategy || 'FEFO';

          // Try to allocate the shortfall
          const result = await this.allocateLine(
            line.order.clientId,
            { ...line, orderedQty: shortfall.toString() },
            strategy,
            tx,
          );

          if (!result.allocated) {
            // Update backorder quantity
            const currentBackorder = new Decimal(line.backorderedQty.toString());
            await this.repository.updateLineBackorderedQty(
              line.id,
              currentBackorder.plus(result.shortfall).toString(),
              tx,
            );
          }
        }
      }

      return this.repository.findPickTaskById(taskId, tx);
    });
  }

  // ==================== CARTON ====================

  async createCarton(
    clientId: string,
    orderId: string,
    input: CreateCartonInput,
  ) {
    return this.tenantPrisma.withTenant(clientId, async (tx) => {
      const order = await this.repository.findOrderById(orderId, tx);

      if (!order || order.clientId !== clientId) {
        throw new WmsException(
          ErrorCodes.ORD_NOT_FOUND,
          'Order not found',
          HttpStatus.NOT_FOUND,
        );
      }

      // Generate carton number if not provided
      const cartons = await this.repository.findCartonsForOrder(orderId, tx);
      const cartonNo = input.cartonNo || `CTN-${cartons.length + 1}`;

      return this.repository.createCarton(
        {
          orderId,
          clientId,
          cartonNo,
          dims: input.dims,
        },
        tx,
      );
    });
  }

  async addCartonLine(
    clientId: string,
    _orderId: string,
    cartonId: string,
    input: AddCartonLineInput,
  ) {
    return this.tenantPrisma.withTenant(clientId, async (tx) => {
      const carton = await this.repository.findCartonById(cartonId, tx);

      if (!carton || carton.order.clientId !== clientId) {
        throw new WmsException(
          ErrorCodes.ORD_NOT_FOUND,
          'Carton not found',
          HttpStatus.NOT_FOUND,
        );
      }

      if (carton.status !== 'OPEN') {
        throw new WmsException(
          ErrorCodes.ORD_INVALID_STATUS,
          'Cannot add lines to closed carton',
          HttpStatus.BAD_REQUEST,
        );
      }

      await this.repository.addCartonLine(
        {
          clientId,
          cartonId,
          itemId: input.itemId,
          lotId: input.lotId,
          qty: input.qty.toString(),
        },
        tx,
      );

      return this.repository.findCartonById(cartonId, tx);
    });
  }

  async closeCarton(clientId: string, _orderId: string, cartonId: string) {
    return this.tenantPrisma.withTenant(clientId, async (tx) => {
      const carton = await this.repository.findCartonById(cartonId, tx);

      if (!carton || carton.order.clientId !== clientId) {
        throw new WmsException(
          ErrorCodes.ORD_NOT_FOUND,
          'Carton not found',
          HttpStatus.NOT_FOUND,
        );
      }

      if (carton.status !== 'OPEN') {
        throw new WmsException(
          ErrorCodes.ORD_INVALID_STATUS,
          'Carton is already closed',
          HttpStatus.BAD_REQUEST,
        );
      }

      return this.repository.closeCarton(cartonId, tx);
    });
  }

  // ==================== SHIPMENT ====================

  async shipConfirm(clientId: string, orderId: string, input: ShipConfirmInput) {
    return this.tenantPrisma.withTenant(clientId, async (tx) => {
      const order = await this.repository.findOrderById(orderId, tx);

      if (!order || order.clientId !== clientId) {
        throw new WmsException(
          ErrorCodes.ORD_NOT_FOUND,
          'Order not found',
          HttpStatus.NOT_FOUND,
        );
      }

      // Check all cartons are closed
      const cartons = await this.repository.findCartonsForOrder(orderId, tx);
      const openCartons = cartons.filter((c) => c.status === 'OPEN');

      if (openCartons.length > 0) {
        throw new WmsException(
          ErrorCodes.ORD_CARTON_OPEN,
          `Cannot ship order with ${openCartons.length} open carton(s)`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Create shipment
      const shipment = await this.repository.createShipment(
        {
          orderId,
          clientId,
          carrierName: input.carrierName,
          trackingNumber: input.trackingNumber,
          ewayBillNo: input.ewayBillNo,
          shipDate: input.shipDate ? new Date(input.shipDate) : undefined,
        },
        tx,
      );

      // Write ledger entries for each carton line
      for (const carton of cartons) {
        for (const line of carton.lines) {
          await this.transactionService.writeLedger(
            {
              clientId,
              txnType: TxnType.SHIP,
              itemId: line.itemId,
              lotId: line.lotId,
              qtyDelta: new Decimal(line.qty.toString()).negated().toString(),
              refType: 'Shipment',
              refId: shipment.id,
              notes: `Shipped ${line.qty} units in carton ${carton.cartonNo}`,
            },
            tx,
          );
        }
      }

      // Update order status
      await this.repository.updateOrder(orderId, { status: 'SHIPPED' }, tx);

      return this.repository.findOrderById(orderId, tx);
    });
  }
}
