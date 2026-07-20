import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { TenantPrismaService } from '../../database/tenant-prisma.service';

@Injectable()
export class PortalService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async getDashboardStats(clientId: string) {
    return this.tenantPrisma.withTenant(clientId, async (tx) => {
      const [skuCount, lots, openOrders, inboundExpected] = await Promise.all([
        tx.item.count({ where: { clientId, active: true } }),
        tx.inventoryLot.findMany({
          where: { clientId, status: { in: ['AVAILABLE', 'RECEIVED'] } },
          select: { qtyOnHand: true, qtyAllocated: true },
        }),
        tx.outboundOrder.count({
          where: {
            clientId,
            status: { notIn: ['SHIPPED', 'CANCELLED'] },
          },
        }),
        tx.inboundReceipt.count({
          where: {
            clientId,
            status: { in: ['EXPECTED', 'ARRIVED', 'RECEIVING'] },
          },
        }),
      ]);

      const unitsOnHand = lots.reduce((sum, lot) => {
        const available = new Decimal(lot.qtyOnHand).minus(lot.qtyAllocated);
        return sum.plus(available.greaterThan(0) ? available : 0);
      }, new Decimal(0));

      return {
        totalSkus: skuCount,
        unitsOnHand: unitsOnHand.toString(),
        openOrders,
        inboundExpected,
      };
    });
  }

  async getExpiringLots(clientId: string, withinDays = 45) {
    return this.tenantPrisma.withTenant(clientId, async (tx) => {
      const until = new Date();
      until.setDate(until.getDate() + withinDays);

      return tx.inventoryLot.findMany({
        where: {
          clientId,
          expiryDate: { not: null, lte: until },
          qtyOnHand: { gt: 0 },
        },
        include: {
          item: true,
          warehouse: { select: { id: true, code: true, name: true } },
          location: { select: { code: true } },
        },
        orderBy: { expiryDate: 'asc' },
        take: 50,
      });
    });
  }

  async listWarehousesForClient(clientId: string) {
    return this.tenantPrisma.withTenant(clientId, async (tx) => {
      // Warehouses that have activity for this client, else all active warehouses
      const used = await tx.inventoryLot.findMany({
        where: { clientId },
        select: { warehouseId: true },
        distinct: ['warehouseId'],
      });
      const ids = used.map((u) => u.warehouseId);
      const warehouses = await tx.warehouse.findMany({
        where: ids.length
          ? { OR: [{ id: { in: ids } }, { active: true }] }
          : { active: true },
        orderBy: { code: 'asc' },
      });
      return warehouses;
    });
  }

  async getAnalytics(clientId: string, periodDays = 30) {
    return this.tenantPrisma.withTenant(clientId, async (tx) => {
      const days = Math.min(Math.max(periodDays, 7), 90);
      const since = new Date();
      since.setDate(since.getDate() - days);
      since.setHours(0, 0, 0, 0);

      const chartSince = new Date();
      chartSince.setDate(chartSince.getDate() - 13);
      chartSince.setHours(0, 0, 0, 0);

      const now = Date.now();

      const [
        recentLines,
        shippedOrders,
        createdOrders,
        activeHolds,
        lots,
        recentOrders,
        pickTxns,
      ] = await Promise.all([
        tx.outboundLine.findMany({
          where: {
            clientId,
            order: { createdAt: { gte: since }, status: { not: 'CANCELLED' } },
          },
          select: {
            itemId: true,
            orderedQty: true,
            pickedQty: true,
            packedQty: true,
            item: { select: { sku: true, description: true } },
          },
        }),
        tx.outboundOrder.count({
          where: {
            clientId,
            status: 'SHIPPED',
            updatedAt: { gte: since },
          },
        }),
        tx.outboundOrder.count({
          where: { clientId, createdAt: { gte: since } },
        }),
        tx.inventoryHold.count({
          where: { clientId, releasedAt: null },
        }),
        tx.inventoryLot.findMany({
          where: { clientId, qtyOnHand: { gt: 0 } },
          select: {
            itemId: true,
            qtyOnHand: true,
            qtyAllocated: true,
            status: true,
            receivedAt: true,
            item: { select: { sku: true, description: true } },
          },
        }),
        tx.outboundOrder.findMany({
          where: { clientId, createdAt: { gte: chartSince } },
          select: { createdAt: true, status: true },
        }),
        tx.inventoryTransaction.findMany({
          where: {
            clientId,
            txnType: { in: ['PICK', 'SHIP'] },
            occurredAt: { gte: since },
          },
          select: {
            itemId: true,
            qtyDelta: true,
            item: { select: { sku: true, description: true } },
          },
        }),
      ]);

      // Movement by item from lines + pick/ship ledger
      const moved = new Map<
        string,
        { sku: string; description: string; units: number; lines: number }
      >();

      for (const line of recentLines) {
        const qty = Math.max(
          Number(line.pickedQty),
          Number(line.packedQty),
          Number(line.orderedQty) * 0.5,
        );
        const cur = moved.get(line.itemId) ?? {
          sku: line.item.sku,
          description: line.item.description,
          units: 0,
          lines: 0,
        };
        cur.units += Number.isFinite(qty) ? qty : 0;
        cur.lines += 1;
        moved.set(line.itemId, cur);
      }

      for (const txn of pickTxns) {
        const qty = Math.abs(Number(txn.qtyDelta));
        const cur = moved.get(txn.itemId) ?? {
          sku: txn.item.sku,
          description: txn.item.description,
          units: 0,
          lines: 0,
        };
        cur.units += Number.isFinite(qty) ? qty : 0;
        moved.set(txn.itemId, cur);
      }

      const stockByItem = new Map<
        string,
        { sku: string; description: string; onHand: number }
      >();
      let unitsOnHand = 0;
      let unitsAllocated = 0;
      const stockByStatusMap = new Map<string, number>();
      const aging = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
      let agingOver90Units = 0;

      for (const lot of lots) {
        const onHand = Number(lot.qtyOnHand);
        const allocated = Number(lot.qtyAllocated);
        unitsOnHand += onHand;
        unitsAllocated += allocated;
        stockByStatusMap.set(
          lot.status,
          (stockByStatusMap.get(lot.status) ?? 0) + onHand,
        );

        const ageDays = Math.floor(
          (now - lot.receivedAt.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (ageDays <= 30) aging['0-30'] += onHand;
        else if (ageDays <= 60) aging['31-60'] += onHand;
        else if (ageDays <= 90) aging['61-90'] += onHand;
        else {
          aging['90+'] += onHand;
          agingOver90Units += onHand;
        }

        const cur = stockByItem.get(lot.itemId) ?? {
          sku: lot.item.sku,
          description: lot.item.description,
          onHand: 0,
        };
        cur.onHand += onHand;
        stockByItem.set(lot.itemId, cur);
      }

      const fastMovers = [...moved.entries()]
        .map(([itemId, v]) => ({
          itemId,
          sku: v.sku,
          description: v.description,
          unitsMoved: Math.round(v.units * 1000) / 1000,
          orderLines: v.lines,
        }))
        .sort((a, b) => b.unitsMoved - a.unitsMoved)
        .slice(0, 8);

      const slowMovers = [...stockByItem.entries()]
        .map(([itemId, v]) => ({
          itemId,
          sku: v.sku,
          description: v.description,
          qtyOnHand: Math.round(v.onHand * 1000) / 1000,
          unitsMoved: Math.round((moved.get(itemId)?.units ?? 0) * 1000) / 1000,
        }))
        .filter((r) => r.qtyOnHand > 0)
        .sort((a, b) => {
          if (a.unitsMoved !== b.unitsMoved) return a.unitsMoved - b.unitsMoved;
          return b.qtyOnHand - a.qtyOnHand;
        })
        .slice(0, 8);

      let orderedTotal = 0;
      let fulfilledTotal = 0;
      for (const line of recentLines) {
        orderedTotal += Number(line.orderedQty);
        fulfilledTotal += Math.max(
          Number(line.pickedQty),
          Number(line.packedQty),
        );
      }
      const fillRatePct =
        orderedTotal > 0
          ? Math.round((fulfilledTotal / orderedTotal) * 1000) / 10
          : 0;

      const unitsShipped = [...moved.values()].reduce(
        (s, v) => s + v.units,
        0,
      );

      // Orders created per day (last 14 days)
      const dayKeys: string[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        dayKeys.push(d.toISOString().slice(0, 10));
      }
      const byDay = new Map(dayKeys.map((k) => [k, 0]));
      const shippedByDay = new Map(dayKeys.map((k) => [k, 0]));
      for (const o of recentOrders) {
        const key = o.createdAt.toISOString().slice(0, 10);
        if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + 1);
        if (o.status === 'SHIPPED' && shippedByDay.has(key)) {
          shippedByDay.set(key, (shippedByDay.get(key) ?? 0) + 1);
        }
      }

      const ordersByDay = dayKeys.map((date) => ({
        date,
        created: byDay.get(date) ?? 0,
        shipped: shippedByDay.get(date) ?? 0,
      }));

      return {
        periodDays: days,
        summary: {
          unitsMoved: Math.round(unitsShipped * 1000) / 1000,
          ordersShipped: shippedOrders,
          ordersCreated: createdOrders,
          fillRatePct,
          activeHolds,
          agingOver90Units: Math.round(agingOver90Units * 1000) / 1000,
          unitsOnHand: Math.round(unitsOnHand * 1000) / 1000,
          unitsAllocated: Math.round(unitsAllocated * 1000) / 1000,
        },
        fastMovers,
        slowMovers,
        ordersByDay,
        agingBuckets: Object.entries(aging).map(([bucket, units]) => ({
          bucket,
          units: Math.round(units * 1000) / 1000,
        })),
        stockByStatus: [...stockByStatusMap.entries()].map(
          ([status, units]) => ({
            status,
            units: Math.round(units * 1000) / 1000,
          }),
        ),
      };
    });
  }
}
