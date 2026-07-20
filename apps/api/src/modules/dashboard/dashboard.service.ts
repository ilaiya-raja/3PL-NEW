import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { TenantPrismaService } from '../../database/tenant-prisma.service';

export interface OpsDashboardStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  receiptsToday: number;
  lowStockItems: number;
  activeWaves: number;
  openOrders: number;
  lateShipments: number;
  activeHolds: number;
  inboundDueToday: number;
  pendingAdjustments: number;
  ordersByStatus: Array<{ name: string; value: number }>;
  recentActivity: Array<{
    id: string;
    type: string;
    title: string;
    at: string;
  }>;
}

const LOW_STOCK_THRESHOLD = 10;

@Injectable()
export class DashboardService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async getOpsStats(): Promise<OpsDashboardStats> {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);
      const now = new Date();

      const [
        totalOrders,
        pendingOrders,
        completedOrders,
        receiptsToday,
        activeWaves,
        itemAvailability,
        lateShipments,
        activeHolds,
        inboundDueToday,
        pendingAdjustments,
        statusGroups,
        recentOrders,
        recentReceipts,
        recentHolds,
        recentAdjustments,
      ] = await Promise.all([
        tx.outboundOrder.count(),
        tx.outboundOrder.count({
          where: { status: { notIn: ['SHIPPED', 'CANCELLED'] } },
        }),
        tx.outboundOrder.count({
          where: { status: 'SHIPPED', updatedAt: { gte: startOfDay } },
        }),
        tx.inboundReceipt.count({
          where: { createdAt: { gte: startOfDay } },
        }),
        tx.wave.count({
          where: { status: { in: ['PLANNING', 'RELEASED'] } },
        }),
        tx.inventoryLot.groupBy({
          by: ['clientId', 'itemId'],
          where: { status: 'AVAILABLE' },
          _sum: { qtyOnHand: true, qtyAllocated: true },
        }),
        tx.outboundOrder.count({
          where: {
            status: { notIn: ['SHIPPED', 'CANCELLED'] },
            slaShipBy: { lt: now },
          },
        }),
        tx.inventoryHold.count({ where: { releasedAt: null } }),
        tx.inboundReceipt.count({
          where: {
            status: { in: ['EXPECTED', 'ARRIVED', 'RECEIVING'] },
            expectedDate: { gte: startOfDay, lt: endOfDay },
          },
        }),
        tx.adjustment.count({ where: { status: 'PENDING_APPROVAL' } }),
        tx.outboundOrder.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
        tx.outboundOrder.findMany({
          orderBy: { updatedAt: 'desc' },
          take: 5,
          select: {
            id: true,
            externalRef: true,
            status: true,
            updatedAt: true,
          },
        }),
        tx.inboundReceipt.findMany({
          orderBy: { updatedAt: 'desc' },
          take: 5,
          select: {
            id: true,
            asnNumber: true,
            status: true,
            updatedAt: true,
          },
        }),
        tx.inventoryHold.findMany({
          where: { releasedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: { id: true, holdType: true, createdAt: true },
        }),
        tx.adjustment.findMany({
          where: { status: 'PENDING_APPROVAL' },
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: { id: true, reasonCode: true, createdAt: true },
        }),
      ]);

      const lowStockItems = itemAvailability.filter((group) => {
        const onHand = group._sum.qtyOnHand ?? new Decimal(0);
        const allocated = group._sum.qtyAllocated ?? new Decimal(0);
        return onHand.minus(allocated).lessThan(LOW_STOCK_THRESHOLD);
      }).length;

      const ordersByStatus = statusGroups.map((g) => ({
        name: g.status,
        value: g._count._all,
      }));

      const recentActivity = [
        ...recentOrders.map((o) => ({
          id: `order-${o.id}`,
          type: 'ORDER',
          title: `Order ${o.externalRef} → ${o.status}`,
          at: o.updatedAt.toISOString(),
        })),
        ...recentReceipts.map((r) => ({
          id: `receipt-${r.id}`,
          type: 'INBOUND',
          title: `ASN ${r.asnNumber || r.id.slice(0, 8)} → ${r.status}`,
          at: r.updatedAt.toISOString(),
        })),
        ...recentHolds.map((h) => ({
          id: `hold-${h.id}`,
          type: 'HOLD',
          title: `Hold placed (${h.holdType})`,
          at: h.createdAt.toISOString(),
        })),
        ...recentAdjustments.map((a) => ({
          id: `adj-${a.id}`,
          type: 'ADJUSTMENT',
          title: `Adjustment pending (${a.reasonCode})`,
          at: a.createdAt.toISOString(),
        })),
      ]
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
        .slice(0, 12);

      return {
        totalOrders,
        pendingOrders,
        completedOrders,
        receiptsToday,
        lowStockItems,
        activeWaves,
        openOrders: pendingOrders,
        lateShipments,
        activeHolds,
        inboundDueToday,
        pendingAdjustments,
        ordersByStatus,
        recentActivity,
      };
    });
  }
}
