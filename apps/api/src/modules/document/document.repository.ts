import { Injectable } from '@nestjs/common';
import type { Prisma } from '@wms/db';
import { DocumentType } from '@wms/types';
import { TenantPrismaService } from '../../database/tenant-prisma.service';
import type { ListDocumentsQueryDto } from './dto/list-documents-query.dto';

@Injectable()
export class DocumentRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async findShipmentDocuments(
    clientId: string,
    query: ListDocumentsQueryDto,
    types: Array<DocumentType.LABEL | DocumentType.POD>,
  ) {
    const createdAt = this.buildDateFilter(query.from, query.to);
    const orConditions: Prisma.ShipmentWhereInput[] = [];

    if (types.includes(DocumentType.LABEL)) {
      orConditions.push({ labelUrl: { not: null } });
    }

    if (types.includes(DocumentType.POD)) {
      orConditions.push({ podUrl: { not: null } });
    }

    if (orConditions.length === 0) {
      return [];
    }

    return this.tenantPrisma.withTenant(clientId, async (tx) =>
      tx.shipment.findMany({
        where: {
          clientId,
          ...(createdAt ? { createdAt } : {}),
          OR: orConditions,
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async findAsnReceipts(clientId: string, query: ListDocumentsQueryDto) {
    const createdAt = this.buildDateFilter(query.from, query.to);

    return this.tenantPrisma.withTenant(clientId, async (tx) =>
      tx.inboundReceipt.findMany({
        where: {
          clientId,
          asnNumber: { not: null },
          ...(createdAt ? { createdAt } : {}),
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async findShipmentById(clientId: string, shipmentId: string) {
    return this.tenantPrisma.withTenant(clientId, async (tx) =>
      tx.shipment.findFirst({
        where: { id: shipmentId, clientId },
      }),
    );
  }

  async findReceiptById(clientId: string, receiptId: string) {
    return this.tenantPrisma.withTenant(clientId, async (tx) =>
      tx.inboundReceipt.findFirst({
        where: { id: receiptId, clientId },
        include: {
          lines: {
            include: {
              item: { select: { sku: true, description: true } },
            },
          },
        },
      }),
    );
  }

  private buildDateFilter(
    from?: string,
    to?: string,
  ): Prisma.DateTimeFilter | undefined {
    if (!from && !to) {
      return undefined;
    }

    const filter: Prisma.DateTimeFilter = {};

    if (from) {
      filter.gte = new Date(from);
    }

    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      filter.lte = end;
    }

    return filter;
  }
}
