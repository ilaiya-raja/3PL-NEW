import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@wms/db';
import { ErrorCodes } from '@wms/types';
import type {
  CreateInvoiceInput,
  CreateManualChargeInput,
  MeterBillingInput,
  UpsertRateCardInput,
} from '@wms/zod-schemas';
import { TenantPrismaService } from '../../database/tenant-prisma.service';
import { WmsException } from '../../common/exceptions/wms.exception';

function toDateOnly(input: string | Date): Date {
  if (input instanceof Date) {
    return new Date(
      Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()),
    );
  }
  const d = input.includes('T') ? new Date(input) : new Date(`${input}T00:00:00.000Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function daysInclusive(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.floor(ms / 86_400_000) + 1);
}

function dec(value: string | number | Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(value.toString());
}

function periodKey(start: Date, end: Date): string {
  return `${start.toISOString().slice(0, 10)}_${end.toISOString().slice(0, 10)}`;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async getRateCard(clientId: string) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const card = await tx.rateCard.findUnique({ where: { clientId } });
      if (!card) {
        throw new WmsException(
          ErrorCodes.BILLING_RATE_CARD_NOT_FOUND,
          'Rate card not found for client',
          HttpStatus.NOT_FOUND,
        );
      }
      return this.mapRateCard(card);
    });
  }

  async upsertRateCard(clientId: string, input: UpsertRateCardInput) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const client = await tx.client.findUnique({ where: { id: clientId } });
      if (!client) {
        throw new WmsException(
          ErrorCodes.CLIENT_NOT_FOUND,
          'Client not found',
          HttpStatus.NOT_FOUND,
        );
      }

      const card = await tx.rateCard.upsert({
        where: { clientId },
        create: {
          clientId,
          currency: input.currency,
          storagePerUnitDay: dec(input.storagePerUnitDay),
          pickPerUnit: dec(input.pickPerUnit),
          packPerOrder: dec(input.packPerOrder),
          shipPerShipment: dec(input.shipPerShipment),
          vasRates: input.vasRates ?? {},
          active: input.active ?? true,
        },
        update: {
          currency: input.currency,
          storagePerUnitDay: dec(input.storagePerUnitDay),
          pickPerUnit: dec(input.pickPerUnit),
          packPerOrder: dec(input.packPerOrder),
          shipPerShipment: dec(input.shipPerShipment),
          vasRates: input.vasRates ?? {},
          active: input.active ?? true,
        },
      });

      return this.mapRateCard(card);
    });
  }

  /** Client charge summaries for billing dashboard. */
  async listChargeSummaries() {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const clients = await tx.client.findMany({
        where: { status: { in: ['ACTIVE', 'ONBOARDING', 'SUSPENDED'] } },
        orderBy: { code: 'asc' },
        include: { rateCard: true },
      });

      const draftTotals = await tx.charge.groupBy({
        by: ['clientId'],
        where: { status: 'DRAFT' },
        _sum: { amount: true },
        _count: { _all: true },
      });
      const draftMap = new Map(
        draftTotals.map((r) => [
          r.clientId,
          {
            amount: r._sum.amount?.toString() ?? '0',
            count: r._count._all,
          },
        ]),
      );

      const issuedTotals = await tx.invoice.groupBy({
        by: ['clientId'],
        where: { status: { in: ['ISSUED', 'PAID'] } },
        _sum: { total: true },
        _count: { _all: true },
      });
      const issuedMap = new Map(
        issuedTotals.map((r) => [
          r.clientId,
          {
            amount: r._sum.total?.toString() ?? '0',
            count: r._count._all,
          },
        ]),
      );

      return clients.map((c) => {
        const draft = draftMap.get(c.id) ?? { amount: '0', count: 0 };
        const issued = issuedMap.get(c.id) ?? { amount: '0', count: 0 };
        return {
          clientId: c.id,
          clientCode: c.code,
          clientName: c.legalName,
          hasRateCard: !!c.rateCard,
          rateCardActive: c.rateCard?.active ?? false,
          draftCharges: draft.amount,
          draftChargeCount: draft.count,
          issuedInvoiceTotal: issued.amount,
          issuedInvoiceCount: issued.count,
          status: draft.count > 0 ? 'DRAFT' : issued.count > 0 ? 'ISSUED' : 'READY',
        };
      });
    });
  }

  async listCharges(query: {
    clientId?: string;
    status?: 'DRAFT' | 'INVOICED' | 'VOID';
    page: number;
    limit: number;
  }) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const where: Prisma.ChargeWhereInput = {
        ...(query.clientId ? { clientId: query.clientId } : {}),
        ...(query.status ? { status: query.status } : {}),
      };
      const [total, rows] = await Promise.all([
        tx.charge.count({ where }),
        tx.charge.findMany({
          where,
          orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          include: { client: { select: { code: true, legalName: true } } },
        }),
      ]);

      return {
        items: rows.map((r) => this.mapCharge(r)),
        meta: { total, page: query.page, limit: query.limit },
      };
    });
  }

  async listInvoices(query: {
    clientId?: string;
    status?: 'DRAFT' | 'ISSUED' | 'PAID' | 'VOID';
    page: number;
    limit: number;
    issuedOnly?: boolean;
  }) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const where: Prisma.InvoiceWhereInput = {
        ...(query.clientId ? { clientId: query.clientId } : {}),
        ...(query.status
          ? { status: query.status }
          : query.issuedOnly
            ? { status: { in: ['ISSUED', 'PAID'] } }
            : {}),
      };
      const [total, rows] = await Promise.all([
        tx.invoice.count({ where }),
        tx.invoice.findMany({
          where,
          orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          include: {
            client: { select: { code: true, legalName: true } },
            lines: true,
          },
        }),
      ]);

      return {
        items: rows.map((r) => this.mapInvoice(r)),
        meta: { total, page: query.page, limit: query.limit },
      };
    });
  }

  async getInvoice(id: string, clientId?: string) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id, ...(clientId ? { clientId } : {}) },
        include: {
          client: { select: { code: true, legalName: true } },
          lines: { include: { charge: true } },
        },
      });
      if (!invoice) {
        throw new WmsException(
          ErrorCodes.BILLING_INVOICE_NOT_FOUND,
          'Invoice not found',
          HttpStatus.NOT_FOUND,
        );
      }
      return this.mapInvoice(invoice, true);
    });
  }

  async listPortalInvoices(clientId: string, page = 1, limit = 50) {
    return this.tenantPrisma.withTenant(clientId, async (tx) => {
      const where: Prisma.InvoiceWhereInput = {
        clientId,
        status: { in: ['ISSUED', 'PAID'] },
      };
      const [total, rows] = await Promise.all([
        tx.invoice.count({ where }),
        tx.invoice.findMany({
          where,
          orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
          include: { lines: true },
        }),
      ]);
      return {
        items: rows.map((r) => this.mapInvoice(r)),
        meta: { total, page, limit },
      };
    });
  }

  async getPortalInvoice(clientId: string, id: string) {
    return this.tenantPrisma.withTenant(clientId, async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: {
          id,
          clientId,
          status: { in: ['ISSUED', 'PAID'] },
        },
        include: { lines: { include: { charge: true } } },
      });
      if (!invoice) {
        throw new WmsException(
          ErrorCodes.BILLING_INVOICE_NOT_FOUND,
          'Invoice not found',
          HttpStatus.NOT_FOUND,
        );
      }
      return this.mapInvoice(invoice, true);
    });
  }

  async meterPeriod(input: MeterBillingInput) {
    const periodStart = toDateOnly(input.periodStart);
    const periodEnd = toDateOnly(input.periodEnd);
    if (periodEnd < periodStart) {
      throw new WmsException(
        ErrorCodes.BILLING_INVALID_STATE,
        'periodEnd must be on or after periodStart',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.tenantPrisma.withOpsRole(async (tx) => {
      const clients = await tx.client.findMany({
        where: {
          status: { in: ['ACTIVE', 'ONBOARDING'] },
          ...(input.clientId ? { id: input.clientId } : {}),
          rateCard: { is: { active: true } },
        },
        include: { rateCard: true },
      });

      const results: Array<{
        clientId: string;
        clientCode: string;
        created: number;
        skipped: number;
      }> = [];

      for (const client of clients) {
        if (!client.rateCard) continue;
        const { created, skipped } = await this.meterClient(
          tx,
          client.id,
          client.code,
          client.rateCard,
          periodStart,
          periodEnd,
        );
        results.push({
          clientId: client.id,
          clientCode: client.code,
          created,
          skipped,
        });
      }

      this.logger.log(
        `Metered ${results.length} client(s) for ${periodKey(periodStart, periodEnd)}`,
      );
      return { periodStart, periodEnd, results };
    });
  }

  /** Default window: previous calendar month (UTC). */
  defaultMeterWindow(now = new Date()): { periodStart: Date; periodEnd: Date } {
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const periodStart = new Date(Date.UTC(y, m - 1, 1));
    const periodEnd = new Date(Date.UTC(y, m, 0));
    return { periodStart, periodEnd };
  }

  async createManualCharge(input: CreateManualChargeInput) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const periodStart = toDateOnly(input.periodStart);
      const periodEnd = toDateOnly(input.periodEnd);
      const qty = dec(input.quantity);
      const rate = dec(input.unitRate);
      const amount = qty.mul(rate);
      const sourceRef = `manual:${input.chargeType}:${Date.now()}`;

      const charge = await tx.charge.create({
        data: {
          clientId: input.clientId,
          chargeType: input.chargeType,
          description: input.description,
          quantity: qty,
          unitRate: rate,
          amount,
          periodStart,
          periodEnd,
          sourceRef,
          status: 'DRAFT',
          meta: input.vasCode ? { vasCode: input.vasCode } : {},
        },
        include: { client: { select: { code: true, legalName: true } } },
      });
      return this.mapCharge(charge);
    });
  }

  async createInvoice(input: CreateInvoiceInput) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const where: Prisma.ChargeWhereInput = {
        clientId: input.clientId,
        status: 'DRAFT',
        ...(input.chargeIds?.length ? { id: { in: input.chargeIds } } : {}),
        ...(input.periodStart
          ? { periodStart: { gte: toDateOnly(input.periodStart) } }
          : {}),
        ...(input.periodEnd
          ? { periodEnd: { lte: toDateOnly(input.periodEnd) } }
          : {}),
      };

      const charges = await tx.charge.findMany({
        where,
        orderBy: { createdAt: 'asc' },
      });

      if (charges.length === 0) {
        throw new WmsException(
          ErrorCodes.BILLING_CHARGE_NOT_FOUND,
          'No draft charges found to invoice',
          HttpStatus.BAD_REQUEST,
        );
      }

      const periodStart = charges.reduce(
        (min, c) => (c.periodStart < min ? c.periodStart : min),
        charges[0].periodStart,
      );
      const periodEnd = charges.reduce(
        (max, c) => (c.periodEnd > max ? c.periodEnd : max),
        charges[0].periodEnd,
      );

      const subtotal = charges.reduce(
        (sum, c) => sum.add(c.amount),
        new Prisma.Decimal(0),
      );
      const taxRate = new Prisma.Decimal(input.taxRatePct ?? 0).div(100);
      const taxAmount = subtotal.mul(taxRate).toDecimalPlaces(4);
      const total = subtotal.add(taxAmount);

      const invoiceNo = await this.nextInvoiceNo(tx, input.clientId, periodStart);

      const invoice = await tx.invoice.create({
        data: {
          clientId: input.clientId,
          invoiceNo,
          periodStart,
          periodEnd,
          subtotal,
          taxAmount,
          total,
          status: 'DRAFT',
          notes: input.notes,
          lines: {
            create: charges.map((c) => ({
              clientId: input.clientId,
              chargeId: c.id,
              description: c.description,
              amount: c.amount,
            })),
          },
        },
        include: {
          client: { select: { code: true, legalName: true } },
          lines: true,
        },
      });

      await tx.charge.updateMany({
        where: { id: { in: charges.map((c) => c.id) } },
        data: { status: 'INVOICED' },
      });

      return this.mapInvoice(invoice, true);
    });
  }

  async issueInvoice(id: string) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id },
        include: {
          client: { select: { code: true, legalName: true } },
          lines: true,
        },
      });
      if (!invoice) {
        throw new WmsException(
          ErrorCodes.BILLING_INVOICE_NOT_FOUND,
          'Invoice not found',
          HttpStatus.NOT_FOUND,
        );
      }
      if (invoice.status !== 'DRAFT') {
        throw new WmsException(
          ErrorCodes.BILLING_INVALID_STATE,
          `Cannot issue invoice in status ${invoice.status}`,
          HttpStatus.CONFLICT,
        );
      }

      const updated = await tx.invoice.update({
        where: { id },
        data: { status: 'ISSUED', issuedAt: new Date() },
        include: {
          client: { select: { code: true, legalName: true } },
          lines: true,
        },
      });
      return this.mapInvoice(updated, true);
    });
  }

  async listVasCatalog() {
    return [
      {
        code: 'RELABEL',
        name: 'Relabeling',
        uom: 'UNIT',
        defaultRate: '2.50',
      },
      {
        code: 'KITTING',
        name: 'Kitting / Assembly',
        uom: 'KIT',
        defaultRate: '15.00',
      },
      {
        code: 'PHOTO',
        name: 'Photo QC',
        uom: 'UNIT',
        defaultRate: '1.00',
      },
    ];
  }

  async listRmaPlaceholders() {
    return {
      items: [] as Array<{
        id: string;
        rmaNumber: string;
        status: string;
        clientCode: string;
      }>,
      meta: { total: 0, page: 1, limit: 20 },
      note: 'RMA module is license-gated; persistence coming in a later phase.',
    };
  }

  async listEdiPartners() {
    return {
      partners: [] as Array<{
        id: string;
        name: string;
        protocol: string;
        active: boolean;
      }>,
      note: 'EDI partner registry is license-gated; configure when EDI feature is activated.',
    };
  }

  private async meterClient(
    tx: Prisma.TransactionClient,
    clientId: string,
    clientCode: string,
    rateCard: {
      currency: string;
      storagePerUnitDay: Prisma.Decimal;
      pickPerUnit: Prisma.Decimal;
      packPerOrder: Prisma.Decimal;
      shipPerShipment: Prisma.Decimal;
    },
    periodStart: Date,
    periodEnd: Date,
  ): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;
    const key = periodKey(periodStart, periodEnd);
    const days = daysInclusive(periodStart, periodEnd);
    const periodEndExclusive = new Date(periodEnd);
    periodEndExclusive.setUTCDate(periodEndExclusive.getUTCDate() + 1);

    const unitsAgg = await tx.inventoryLot.aggregate({
      where: { clientId, qtyOnHand: { gt: 0 } },
      _sum: { qtyOnHand: true },
    });
    const unitsOnHand = new Prisma.Decimal(unitsAgg._sum.qtyOnHand ?? 0);
    const storageQty = unitsOnHand.mul(days);
    if (storageQty.gt(0) && rateCard.storagePerUnitDay.gt(0)) {
      const r = await this.upsertMeterCharge(tx, {
        clientId,
        chargeType: 'STORAGE',
        description: `Storage ${unitsOnHand.toString()} units × ${days} days`,
        quantity: storageQty,
        unitRate: rateCard.storagePerUnitDay,
        periodStart,
        periodEnd,
        sourceRef: `storage:${key}`,
        currency: rateCard.currency,
        meta: { unitsOnHand: unitsOnHand.toString(), days, clientCode },
      });
      r === 'created' ? created++ : skipped++;
    }

    const pickAgg = await tx.inventoryTransaction.aggregate({
      where: {
        clientId,
        txnType: 'PICK',
        occurredAt: { gte: periodStart, lt: periodEndExclusive },
      },
      _sum: { qtyDelta: true },
    });
    const pickUnits = new Prisma.Decimal(pickAgg._sum.qtyDelta ?? 0).abs();
    if (pickUnits.gt(0) && rateCard.pickPerUnit.gt(0)) {
      const r = await this.upsertMeterCharge(tx, {
        clientId,
        chargeType: 'PICK',
        description: `Picks ${pickUnits.toString()} units`,
        quantity: pickUnits,
        unitRate: rateCard.pickPerUnit,
        periodStart,
        periodEnd,
        sourceRef: `pick:${key}`,
        currency: rateCard.currency,
        meta: { clientCode },
      });
      r === 'created' ? created++ : skipped++;
    }

    const packedOrders = await tx.outboundOrder.count({
      where: {
        clientId,
        status: { in: ['PACKED', 'SHIPPED'] },
        updatedAt: { gte: periodStart, lt: periodEndExclusive },
      },
    });
    if (packedOrders > 0 && rateCard.packPerOrder.gt(0)) {
      const r = await this.upsertMeterCharge(tx, {
        clientId,
        chargeType: 'PACK',
        description: `Pack ${packedOrders} orders`,
        quantity: dec(packedOrders),
        unitRate: rateCard.packPerOrder,
        periodStart,
        periodEnd,
        sourceRef: `pack:${key}`,
        currency: rateCard.currency,
        meta: { clientCode },
      });
      r === 'created' ? created++ : skipped++;
    }

    const shippedCount = await tx.outboundOrder.count({
      where: {
        clientId,
        status: 'SHIPPED',
        updatedAt: { gte: periodStart, lt: periodEndExclusive },
      },
    });
    if (shippedCount > 0 && rateCard.shipPerShipment.gt(0)) {
      const r = await this.upsertMeterCharge(tx, {
        clientId,
        chargeType: 'SHIP',
        description: `Ship ${shippedCount} orders`,
        quantity: dec(shippedCount),
        unitRate: rateCard.shipPerShipment,
        periodStart,
        periodEnd,
        sourceRef: `ship:${key}`,
        currency: rateCard.currency,
        meta: { clientCode },
      });
      r === 'created' ? created++ : skipped++;
    }

    return { created, skipped };
  }

  private async upsertMeterCharge(
    tx: Prisma.TransactionClient,
    data: {
      clientId: string;
      chargeType: 'STORAGE' | 'PICK' | 'PACK' | 'SHIP';
      description: string;
      quantity: Prisma.Decimal;
      unitRate: Prisma.Decimal;
      periodStart: Date;
      periodEnd: Date;
      sourceRef: string;
      currency: string;
      meta: Record<string, unknown>;
    },
  ): Promise<'created' | 'skipped'> {
    const existing = await tx.charge.findUnique({
      where: {
        clientId_chargeType_sourceRef: {
          clientId: data.clientId,
          chargeType: data.chargeType,
          sourceRef: data.sourceRef,
        },
      },
    });
    if (existing) {
      return 'skipped';
    }

    const amount = data.quantity.mul(data.unitRate).toDecimalPlaces(4);
    await tx.charge.create({
      data: {
        clientId: data.clientId,
        chargeType: data.chargeType,
        description: data.description,
        quantity: data.quantity,
        unitRate: data.unitRate,
        amount,
        currency: data.currency,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        sourceRef: data.sourceRef,
        status: 'DRAFT',
        meta: data.meta as Prisma.InputJsonValue,
      },
    });
    return 'created';
  }

  private async nextInvoiceNo(
    tx: Prisma.TransactionClient,
    clientId: string,
    periodStart: Date,
  ): Promise<string> {
    const ym = `${periodStart.getUTCFullYear()}${String(periodStart.getUTCMonth() + 1).padStart(2, '0')}`;
    const prefix = `INV-${ym}-`;
    const latest = await tx.invoice.findFirst({
      where: { clientId, invoiceNo: { startsWith: prefix } },
      orderBy: { invoiceNo: 'desc' },
      select: { invoiceNo: true },
    });
    const next = latest
      ? Number(latest.invoiceNo.slice(prefix.length)) + 1
      : 1;
    return `${prefix}${String(next).padStart(4, '0')}`;
  }

  private mapRateCard(card: {
    id: string;
    clientId: string;
    currency: string;
    storagePerUnitDay: Prisma.Decimal;
    pickPerUnit: Prisma.Decimal;
    packPerOrder: Prisma.Decimal;
    shipPerShipment: Prisma.Decimal;
    vasRates: Prisma.JsonValue;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: card.id,
      clientId: card.clientId,
      currency: card.currency,
      storagePerUnitDay: card.storagePerUnitDay.toString(),
      pickPerUnit: card.pickPerUnit.toString(),
      packPerOrder: card.packPerOrder.toString(),
      shipPerShipment: card.shipPerShipment.toString(),
      vasRates: (card.vasRates ?? {}) as Record<string, string>,
      active: card.active,
      createdAt: card.createdAt.toISOString(),
      updatedAt: card.updatedAt.toISOString(),
    };
  }

  private mapCharge(row: {
    id: string;
    clientId: string;
    chargeType: string;
    description: string;
    quantity: Prisma.Decimal;
    unitRate: Prisma.Decimal;
    amount: Prisma.Decimal;
    currency: string;
    periodStart: Date;
    periodEnd: Date;
    sourceRef: string;
    status: string;
    meta: Prisma.JsonValue;
    createdAt: Date;
    client?: { code: string; legalName: string };
  }) {
    return {
      id: row.id,
      clientId: row.clientId,
      clientCode: row.client?.code,
      clientName: row.client?.legalName,
      chargeType: row.chargeType,
      description: row.description,
      quantity: row.quantity.toString(),
      unitRate: row.unitRate.toString(),
      amount: row.amount.toString(),
      currency: row.currency,
      periodStart: row.periodStart.toISOString().slice(0, 10),
      periodEnd: row.periodEnd.toISOString().slice(0, 10),
      sourceRef: row.sourceRef,
      status: row.status,
      meta: row.meta,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private mapInvoice(
    row: {
      id: string;
      clientId: string;
      invoiceNo: string;
      periodStart: Date;
      periodEnd: Date;
      currency: string;
      subtotal: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      total: Prisma.Decimal;
      status: string;
      issuedAt: Date | null;
      notes: string | null;
      createdAt: Date;
      client?: { code: string; legalName: string };
      lines?: Array<{
        id: string;
        description: string;
        amount: Prisma.Decimal;
        chargeId: string;
        charge?: {
          chargeType: string;
          quantity: Prisma.Decimal;
          unitRate: Prisma.Decimal;
        };
      }>;
    },
    withLines = false,
  ) {
    return {
      id: row.id,
      clientId: row.clientId,
      clientCode: row.client?.code,
      clientName: row.client?.legalName,
      invoiceNo: row.invoiceNo,
      periodStart: row.periodStart.toISOString().slice(0, 10),
      periodEnd: row.periodEnd.toISOString().slice(0, 10),
      currency: row.currency,
      subtotal: row.subtotal.toString(),
      taxAmount: row.taxAmount.toString(),
      total: row.total.toString(),
      status: row.status,
      issuedAt: row.issuedAt?.toISOString() ?? null,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      lines: withLines
        ? (row.lines ?? []).map((l) => ({
            id: l.id,
            chargeId: l.chargeId,
            description: l.description,
            amount: l.amount.toString(),
            chargeType: l.charge?.chargeType,
            quantity: l.charge?.quantity.toString(),
            unitRate: l.charge?.unitRate.toString(),
          }))
        : undefined,
      lineCount: row.lines?.length,
    };
  }
}
