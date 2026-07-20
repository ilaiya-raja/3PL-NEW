import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { OpsRole } from '@wms/types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantPrismaService } from '../../database/tenant-prisma.service';
import {
  NotificationsService,
  type NotificationEvent,
} from './notifications.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  @Get()
  @Roles(OpsRole.ADMIN, OpsRole.SUPERVISOR, OpsRole.READONLY)
  list(@Query('limit') limit?: string) {
    return this.notifications.listRecent(Number(limit) || 50);
  }

  @Post('test')
  @Roles(OpsRole.ADMIN)
  test(@Body() body: Partial<NotificationEvent>) {
    return this.notifications.notify({
      type: body.type || 'GENERIC',
      subject: body.subject || 'Test notification',
      body: body.body || 'This is a test notification from WMS.',
      to: body.to,
    });
  }

  /** Scan for late ASNs / late orders and enqueue notifications (ops trigger). */
  @Post('scan')
  @Roles(OpsRole.ADMIN, OpsRole.SUPERVISOR)
  async scan() {
    const now = new Date();
    const results: Array<{ type: string; id: string }> = [];

    await this.tenantPrisma.withOpsRole(async (tx) => {
      const lateAsns = await tx.inboundReceipt.findMany({
        where: {
          status: { in: ['EXPECTED', 'ARRIVED'] },
          expectedDate: { lt: now },
        },
        take: 20,
        select: {
          id: true,
          asnNumber: true,
          clientId: true,
          expectedDate: true,
        },
      });

      for (const asn of lateAsns) {
        await this.notifications.notify({
          type: 'LATE_ASN',
          subject: `Late ASN ${asn.asnNumber || asn.id.slice(0, 8)}`,
          body: `ASN expected ${asn.expectedDate?.toISOString() ?? 'N/A'} is still ${asn.asnNumber ? 'open' : 'pending'}.`,
          meta: { receiptId: asn.id, clientId: asn.clientId },
        });
        results.push({ type: 'LATE_ASN', id: asn.id });
      }

      const lateOrders = await tx.outboundOrder.findMany({
        where: {
          status: { notIn: ['SHIPPED', 'CANCELLED'] },
          slaShipBy: { lt: now },
        },
        take: 20,
        select: { id: true, externalRef: true, clientId: true, slaShipBy: true },
      });

      for (const order of lateOrders) {
        await this.notifications.notify({
          type: 'ORDER_LATE',
          subject: `Late order ${order.externalRef}`,
          body: `Order SLA ship-by ${order.slaShipBy?.toISOString() ?? 'N/A'} has passed.`,
          meta: { orderId: order.id, clientId: order.clientId },
        });
        results.push({ type: 'ORDER_LATE', id: order.id });
      }
    });

    return { scanned: results.length, results };
  }
}
