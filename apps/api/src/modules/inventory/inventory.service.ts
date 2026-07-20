import { HttpStatus, Injectable, Optional } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { LotStatus, Prisma } from '@wms/db';
import { ErrorCodes } from '@wms/types';
import type { ClientConfig } from '@wms/types';
import type {
  PlaceHoldInput,
  CreateAdjustmentInput,
  ListInventoryQuery,
} from '@wms/zod-schemas';
import { TenantPrismaService } from '../../database/tenant-prisma.service';
import { WmsException } from '../../common/exceptions/wms.exception';
import type { PaginationParams } from '../../common/utils/pagination';
import { calculatePagination } from '../../common/utils/pagination';
import { NotificationsService } from '../notifications/notifications.service';
import { InventoryRepository } from './inventory.repository';
import { InventoryTransactionService } from './inventory-transaction.service';

@Injectable()
export class InventoryService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly repository: InventoryRepository,
    private readonly transactionService: InventoryTransactionService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  async listInventory(
    clientId: string,
    query: ListInventoryQuery,
    useOpsRole = false,
  ) {
    if (useOpsRole) {
      return this.tenantPrisma.withOpsRole(async (tx) => {
        return this.listInventoryInTx(clientId, query, tx);
      });
    }

    return this.tenantPrisma.withTenant(clientId, async (tx) => {
      return this.listInventoryInTx(clientId, query, tx);
    });
  }

  async listAllInventoryOps(query: ListInventoryQuery) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      return this.listInventoryInTx(query.clientId, query, tx);
    });
  }

  private async listInventoryInTx(
    clientId: string | undefined,
    query: ListInventoryQuery,
    tx: Prisma.TransactionClient,
  ) {
    const pagination: PaginationParams = {
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      search: query.search,
    };

    const filter = {
      clientId,
      warehouseId: query.warehouseId,
      itemId: query.itemId,
      status: query.status as LotStatus | undefined,
      lotNumber: query.lotNumber,
      lpn: query.lpn,
      search: query.search,
    };

    const { lots, total } = await this.repository.findLots(
      filter,
      pagination,
      tx,
    );

    return {
      data: lots,
      pagination: calculatePagination(query.page, query.limit, total),
    };
  }

  async getInventoryByItem(
    clientId: string,
    itemId: string,
    useOpsRole = false,
  ) {
    if (useOpsRole) {
      return this.tenantPrisma.withOpsRole(async (tx) => {
        const lots = await this.repository.findLotsByItem(clientId, itemId, tx);

        const totalAvailable = lots
          .filter((l) => l.status === 'AVAILABLE')
          .reduce(
            (sum, l) =>
              sum.plus(new Decimal(l.qtyOnHand).minus(l.qtyAllocated)),
            new Decimal(0),
          );

        const totalOnHand = lots.reduce(
          (sum, l) => sum.plus(l.qtyOnHand),
          new Decimal(0),
        );

        const totalAllocated = lots.reduce(
          (sum, l) => sum.plus(l.qtyAllocated),
          new Decimal(0),
        );

        return {
          itemId,
          lots,
          summary: {
            totalAvailable: totalAvailable.toString(),
            totalOnHand: totalOnHand.toString(),
            totalAllocated: totalAllocated.toString(),
          },
        };
      });
    } else {
      return this.tenantPrisma.withTenant(clientId, async (tx) => {
        const lots = await this.repository.findLotsByItem(clientId, itemId, tx);

        const totalAvailable = lots
          .filter((l) => l.status === 'AVAILABLE')
          .reduce(
            (sum, l) =>
              sum.plus(new Decimal(l.qtyOnHand).minus(l.qtyAllocated)),
            new Decimal(0),
          );

        const totalOnHand = lots.reduce(
          (sum, l) => sum.plus(l.qtyOnHand),
          new Decimal(0),
        );

        const totalAllocated = lots.reduce(
          (sum, l) => sum.plus(l.qtyAllocated),
          new Decimal(0),
        );

        return {
          itemId,
          lots,
          summary: {
            totalAvailable: totalAvailable.toString(),
            totalOnHand: totalOnHand.toString(),
            totalAllocated: totalAllocated.toString(),
          },
        };
      });
    }
  }

  async getLotHistory(
    clientId: string,
    lotId: string,
    pagination: PaginationParams,
    useOpsRole = false,
  ) {
    if (useOpsRole) {
      return this.tenantPrisma.withOpsRole(async (tx) => {
        const lot = await this.repository.findLotById(lotId, tx);
        if (!lot || lot.clientId !== clientId) {
          throw new WmsException(
            ErrorCodes.INV_LOT_NOT_FOUND,
            'Lot not found',
            HttpStatus.NOT_FOUND,
          );
        }

        const { transactions, total } =
          await this.repository.findTransactionsByLot(lotId, pagination, tx);

        return {
          data: transactions,
          pagination: calculatePagination(
            pagination.page,
            pagination.limit,
            total,
          ),
        };
      });
    } else {
      return this.tenantPrisma.withTenant(clientId, async (tx) => {
        const lot = await this.repository.findLotById(lotId, tx);
        if (!lot || lot.clientId !== clientId) {
          throw new WmsException(
            ErrorCodes.INV_LOT_NOT_FOUND,
            'Lot not found',
            HttpStatus.NOT_FOUND,
          );
        }

        const { transactions, total } =
          await this.repository.findTransactionsByLot(lotId, pagination, tx);

        return {
          data: transactions,
          pagination: calculatePagination(
            pagination.page,
            pagination.limit,
            total,
          ),
        };
      });
    }
  }

  async placeHold(
    clientId: string,
    input: PlaceHoldInput,
    actorId: string,
    useOpsRole = false,
  ) {
    if (useOpsRole) {
      return this.tenantPrisma.withOpsRole(async (tx) => {
        return this.placeHoldLogic(clientId, input, actorId, tx);
      });
    } else {
      return this.tenantPrisma.withTenant(clientId, async (tx) => {
        return this.placeHoldLogic(clientId, input, actorId, tx);
      });
    }
  }

  private async placeHoldLogic(
    clientId: string,
    input: PlaceHoldInput,
    actorId: string,
    tx: any,
  ) {
    const hold = await this.repository.createHold(
      {
        clientId,
        itemId: input.itemId,
        lotId: input.lotId,
        locationId: input.locationId,
        holdType: input.holdType as any,
        reason: input.reason,
        heldBy: actorId,
      },
      tx,
    );

    const affectedLots = await this.repository.findAffectedLotsByHold(
      clientId,
      {
        itemId: input.itemId,
        lotId: input.lotId,
        locationId: input.locationId,
      },
      tx,
    );

    const targetStatus = input.holdType === 'QC_HOLD' ? 'QC_HOLD' : 'ON_HOLD';

    for (const lot of affectedLots) {
      const oldStatus = lot.status;
      await this.repository.updateLotStatus(lot.id, targetStatus as any, tx);

      if (lot.allocations && lot.allocations.length > 0) {
        await this.repository.deallocateLot(lot.id, tx);
      }

      await this.transactionService.writeLedger(
        {
          clientId,
          txnType: 'HOLD' as any,
          itemId: lot.itemId,
          lotId: lot.id,
          fromLocationId: lot.locationId,
          toLocationId: lot.locationId,
          qtyDelta: '0',
          statusFrom: oldStatus as any,
          statusTo: targetStatus as any,
          refType: 'hold',
          refId: hold.id,
          actorId,
          notes: input.reason,
        },
        tx,
      );
    }

    void this.notifications?.notify({
      type: 'HOLD_PLACED',
      subject: `Hold placed (${input.holdType})`,
      body: `A ${input.holdType} hold was placed for client ${clientId}.\nReason: ${input.reason}`,
      meta: { clientId, holdId: hold.id, holdType: input.holdType },
    });

    return hold;
  }

  async listHolds(
    clientId: string,
    filter: { active?: boolean; holdType?: string },
    pagination: PaginationParams,
    useOpsRole = false,
  ) {
    if (useOpsRole) {
      return this.tenantPrisma.withOpsRole(async (tx) => {
        const { holds, total } = await this.repository.findHolds(
          clientId,
          filter as any,
          pagination,
          tx,
        );

        return {
          data: holds,
          pagination: calculatePagination(
            pagination.page,
            pagination.limit,
            total,
          ),
        };
      });
    } else {
      return this.tenantPrisma.withTenant(clientId, async (tx) => {
        const { holds, total } = await this.repository.findHolds(
          clientId,
          filter as any,
          pagination,
          tx,
        );

        return {
          data: holds,
          pagination: calculatePagination(
            pagination.page,
            pagination.limit,
            total,
          ),
        };
      });
    }
  }

  async releaseHold(
    clientId: string,
    holdId: string,
    actorId: string,
    useOpsRole = false,
  ) {
    if (useOpsRole) {
      return this.tenantPrisma.withOpsRole(async (tx) => {
        return this.releaseHoldLogic(clientId, holdId, actorId, tx);
      });
    } else {
      return this.tenantPrisma.withTenant(clientId, async (tx) => {
        return this.releaseHoldLogic(clientId, holdId, actorId, tx);
      });
    }
  }

  private async releaseHoldLogic(
    clientId: string,
    holdId: string,
    actorId: string,
    tx: any,
  ) {
    const hold = await this.repository.findHoldById(holdId, tx);

    if (!hold || hold.clientId !== clientId) {
      throw new WmsException(
        ErrorCodes.INV_HOLD_NOT_FOUND,
        'Hold not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (!hold.active) {
      throw new WmsException(
        ErrorCodes.INV_HOLD_ALREADY_RELEASED,
        'Hold already released',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.repository.releaseHold(holdId, actorId, tx);

    const affectedLots = await this.repository.findAffectedLotsByHold(
      clientId,
      {
        itemId: hold.itemId ?? undefined,
        lotId: hold.lotId ?? undefined,
        locationId: hold.locationId ?? undefined,
      },
      tx,
    );

    for (const lot of affectedLots) {
      if (lot.status === 'ON_HOLD' || lot.status === 'QC_HOLD') {
        const oldStatus = lot.status;
        const newStatus = lot.locationId ? 'AVAILABLE' : 'RECEIVED';

        await this.repository.updateLotStatus(lot.id, newStatus as any, tx);

        await this.transactionService.writeLedger(
          {
            clientId,
            txnType: 'RELEASE' as any,
            itemId: lot.itemId,
            lotId: lot.id,
            fromLocationId: lot.locationId,
            toLocationId: lot.locationId,
            qtyDelta: '0',
            statusFrom: oldStatus as any,
            statusTo: newStatus as any,
            refType: 'hold',
            refId: holdId,
            actorId,
          },
          tx,
        );
      }
    }

    return { success: true };
  }

  async createAdjustment(
    clientId: string,
    input: CreateAdjustmentInput,
    actorId: string,
    useOpsRole = false,
  ) {
    if (useOpsRole) {
      return this.tenantPrisma.withOpsRole(async (tx) => {
        return this.createAdjustmentLogic(clientId, input, actorId, tx);
      });
    } else {
      return this.tenantPrisma.withTenant(clientId, async (tx) => {
        return this.createAdjustmentLogic(clientId, input, actorId, tx);
      });
    }
  }

  private async createAdjustmentLogic(
    clientId: string,
    input: CreateAdjustmentInput,
    actorId: string,
    tx: any,
  ) {
    const lot = await this.repository.findLotById(input.lotId, tx);
    if (!lot || lot.clientId !== clientId) {
      throw new WmsException(
        ErrorCodes.INV_LOT_NOT_FOUND,
        'Lot not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (lot.itemId !== input.itemId) {
      throw new WmsException(
        ErrorCodes.VAL_VALIDATION_FAILED,
        'Item ID does not match lot',
        HttpStatus.BAD_REQUEST,
      );
    }

    const client = await this.repository.findClientById(clientId, tx);
    const config = (client?.config ?? {}) as ClientConfig;
    const threshold = config.adjustmentAutoApproveThreshold ?? 10;

    const qtyDeltaNum = Math.abs(Number(input.qtyDelta));
    const shouldAutoApprove = qtyDeltaNum <= threshold;

    if (shouldAutoApprove) {
      const adjustment = await this.repository.createAdjustment(
        {
          clientId,
          itemId: input.itemId,
          lotId: input.lotId,
          locationId: input.locationId,
          qtyDelta: input.qtyDelta.toString(),
          reasonCode: input.reasonCode,
          notes: input.notes,
          status: 'APPROVED',
          requestedBy: actorId,
          approvedBy: actorId,
        },
        tx,
      );

      await this.repository.updateLotQuantity(
        input.lotId,
        input.qtyDelta.toString(),
        tx,
      );

      await this.transactionService.writeLedger(
        {
          clientId,
          txnType: 'ADJUST' as any,
          itemId: input.itemId,
          lotId: input.lotId,
          fromLocationId: lot.locationId,
          toLocationId: lot.locationId,
          qtyDelta: input.qtyDelta.toString(),
          statusFrom: lot.status as any,
          statusTo: lot.status as any,
          refType: 'adjustment',
          refId: adjustment.id,
          actorId,
          notes: input.notes,
        },
        tx,
      );

      return adjustment;
    } else {
      const adjustment = await this.repository.createAdjustment(
        {
          clientId,
          itemId: input.itemId,
          lotId: input.lotId,
          locationId: input.locationId,
          qtyDelta: input.qtyDelta.toString(),
          reasonCode: input.reasonCode,
          notes: input.notes,
          status: 'PENDING_APPROVAL',
          requestedBy: actorId,
        },
        tx,
      );

      void this.notifications?.notify({
        type: 'ADJUSTMENT_PENDING',
        subject: `Adjustment pending approval (${input.reasonCode})`,
        body: `Adjustment ${adjustment.id} for lot ${input.lotId} awaits approval.\nDelta: ${input.qtyDelta}\nReason: ${input.reasonCode}`,
        meta: { clientId, adjustmentId: adjustment.id },
      });

      return adjustment;
    }
  }

  async listAdjustments(
    clientId: string,
    filter: { status?: string },
    pagination: PaginationParams,
    useOpsRole = false,
  ) {
    if (useOpsRole) {
      return this.tenantPrisma.withOpsRole(async (tx) => {
        const { adjustments, total } = await this.repository.findAdjustments(
          clientId,
          filter as any,
          pagination,
          tx,
        );

        return {
          data: adjustments,
          pagination: calculatePagination(
            pagination.page,
            pagination.limit,
            total,
          ),
        };
      });
    } else {
      return this.tenantPrisma.withTenant(clientId, async (tx) => {
        const { adjustments, total } = await this.repository.findAdjustments(
          clientId,
          filter as any,
          pagination,
          tx,
        );

        return {
          data: adjustments,
          pagination: calculatePagination(
            pagination.page,
            pagination.limit,
            total,
          ),
        };
      });
    }
  }

  async approveAdjustment(
    clientId: string,
    adjustmentId: string,
    actorId: string,
  ) {
    return this.tenantPrisma.withTenant(clientId, async (tx) => {
      const adjustment = await this.repository.findAdjustmentById(
        adjustmentId,
        tx,
      );

      if (!adjustment || adjustment.clientId !== clientId) {
        throw new WmsException(
          ErrorCodes.INV_ADJUSTMENT_NOT_FOUND,
          'Adjustment not found',
          HttpStatus.NOT_FOUND,
        );
      }

      if (adjustment.status !== 'PENDING_APPROVAL') {
        throw new WmsException(
          ErrorCodes.INV_ADJUSTMENT_INVALID_STATUS,
          'Adjustment is not pending approval',
          HttpStatus.BAD_REQUEST,
        );
      }

      await this.repository.updateAdjustmentStatus(
        adjustmentId,
        'APPROVED',
        actorId,
        tx,
      );

      await this.repository.updateLotQuantity(
        adjustment.lotId,
        adjustment.qtyDelta.toString(),
        tx,
      );

      await this.transactionService.writeLedger(
        {
          clientId,
          txnType: 'ADJUST' as any,
          itemId: adjustment.itemId,
          lotId: adjustment.lotId,
          fromLocationId: adjustment.lot.locationId,
          toLocationId: adjustment.lot.locationId,
          qtyDelta: adjustment.qtyDelta.toString(),
          statusFrom: adjustment.lot.status as any,
          statusTo: adjustment.lot.status as any,
          refType: 'adjustment',
          refId: adjustmentId,
          actorId,
          notes: adjustment.notes,
        },
        tx,
      );

      return { success: true };
    });
  }

  async rejectAdjustment(
    clientId: string,
    adjustmentId: string,
    actorId: string,
  ) {
    return this.tenantPrisma.withTenant(clientId, async (tx) => {
      const adjustment = await this.repository.findAdjustmentById(
        adjustmentId,
        tx,
      );

      if (!adjustment || adjustment.clientId !== clientId) {
        throw new WmsException(
          ErrorCodes.INV_ADJUSTMENT_NOT_FOUND,
          'Adjustment not found',
          HttpStatus.NOT_FOUND,
        );
      }

      if (adjustment.status !== 'PENDING_APPROVAL') {
        throw new WmsException(
          ErrorCodes.INV_ADJUSTMENT_INVALID_STATUS,
          'Adjustment is not pending approval',
          HttpStatus.BAD_REQUEST,
        );
      }

      await this.repository.updateAdjustmentStatus(
        adjustmentId,
        'REJECTED',
        actorId,
        tx,
      );

      return { success: true };
    });
  }
}
