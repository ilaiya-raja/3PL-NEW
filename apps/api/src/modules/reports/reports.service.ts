import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { TenantPrismaService } from '../../database/tenant-prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async stockByClient() {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const rows = await tx.inventoryLot.groupBy({
        by: ['clientId'],
        _sum: { qtyOnHand: true, qtyAllocated: true },
        _count: { _all: true },
      });
      const clients = await tx.client.findMany({
        select: { id: true, code: true, legalName: true },
      });
      const byId = new Map(clients.map((c) => [c.id, c]));
      return rows.map((r) => {
        const onHand = new Decimal(r._sum.qtyOnHand ?? 0);
        const allocated = new Decimal(r._sum.qtyAllocated ?? 0);
        const client = byId.get(r.clientId);
        return {
          clientId: r.clientId,
          clientCode: client?.code ?? '—',
          clientName: client?.legalName ?? '—',
          lotCount: r._count._all,
          qtyOnHand: onHand.toString(),
          qtyAllocated: allocated.toString(),
          qtyAvailable: onHand.minus(allocated).toString(),
        };
      });
    });
  }

  async orderSla() {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const now = new Date();
      const open = await tx.outboundOrder.findMany({
        where: {
          status: { notIn: ['SHIPPED', 'CANCELLED'] },
          slaShipBy: { not: null },
        },
        select: {
          id: true,
          externalRef: true,
          status: true,
          slaShipBy: true,
          clientId: true,
          warehouse: { select: { code: true, name: true } },
          client: { select: { code: true, legalName: true } },
        },
        orderBy: { slaShipBy: 'asc' },
        take: 200,
      });
      return open.map((o) => ({
        ...o,
        late: o.slaShipBy ? o.slaShipBy < now : false,
        daysUntilDue: o.slaShipBy
          ? Math.ceil(
              (o.slaShipBy.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
            )
          : null,
      }));
    });
  }

  async agingInventory(daysBuckets = [30, 60, 90]) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const lots = await tx.inventoryLot.findMany({
        where: { qtyOnHand: { gt: 0 } },
        select: {
          id: true,
          clientId: true,
          qtyOnHand: true,
          receivedAt: true,
          item: { select: { sku: true, description: true } },
          client: { select: { code: true } },
          warehouse: { select: { code: true } },
        },
        take: 500,
        orderBy: { receivedAt: 'asc' },
      });
      const now = Date.now();
      return lots.map((lot) => {
        const ageDays = Math.floor(
          (now - lot.receivedAt.getTime()) / (1000 * 60 * 60 * 24),
        );
        let bucket = `${daysBuckets[daysBuckets.length - 1]}+`;
        for (const b of daysBuckets) {
          if (ageDays <= b) {
            bucket = `0-${b}`;
            break;
          }
        }
        if (ageDays > daysBuckets[0] && ageDays <= daysBuckets[1]) {
          bucket = `${daysBuckets[0] + 1}-${daysBuckets[1]}`;
        } else if (ageDays > daysBuckets[1] && ageDays <= daysBuckets[2]) {
          bucket = `${daysBuckets[1] + 1}-${daysBuckets[2]}`;
        } else if (ageDays > daysBuckets[2]) {
          bucket = `${daysBuckets[2]}+`;
        }
        return {
          lotId: lot.id,
          sku: lot.item.sku,
          description: lot.item.description,
          clientCode: lot.client.code,
          warehouseCode: lot.warehouse.code,
          qtyOnHand: lot.qtyOnHand.toString(),
          ageDays,
          bucket,
        };
      });
    });
  }

  async ledger(params: {
    clientId?: string;
    itemId?: string;
    lotId?: string;
    page: number;
    limit: number;
  }) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const where = {
        ...(params.clientId && { clientId: params.clientId }),
        ...(params.itemId && { itemId: params.itemId }),
        ...(params.lotId && { lotId: params.lotId }),
      };
      const skip = (params.page - 1) * params.limit;
      const [items, total] = await Promise.all([
        tx.inventoryTransaction.findMany({
          where,
          include: {
            item: { select: { sku: true, description: true } },
            lot: { select: { lotNumber: true, lpn: true } },
            client: { select: { code: true } },
          },
          orderBy: { occurredAt: 'desc' },
          skip,
          take: params.limit,
        }),
        tx.inventoryTransaction.count({ where }),
      ]);
      return {
        data: items,
        pagination: {
          page: params.page,
          limit: params.limit,
          total,
          totalPages: Math.ceil(total / params.limit) || 1,
        },
      };
    });
  }
}
