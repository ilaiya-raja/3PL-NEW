import {
  PrismaClient,
  OpsRole,
  PortalRole,
  ZoneType,
  TempClass,
  LocationType,
  ClientStatus,
  LotStatus,
  ReceiptStatus,
  OrderStatus,
  TxnType,
  HoldType,
  AdjustmentStatus,
  WaveStatus,
  AppointmentStatus,
  Prisma,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { generateKeyPairSync, randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

async function upsertOpsUser(
  email: string,
  password: string,
  name: string,
  role: OpsRole,
): Promise<void> {
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.opsUser.upsert({
    where: { email },
    update: { passwordHash, name, role, active: true },
    create: { email, passwordHash, name, role, active: true },
  });
}

async function ensureDevLicense(): Promise<void> {
  const existing = await prisma.license.findFirst({ where: { active: true } });
  if (existing) return;

  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  const payload = {
    licenseId: randomUUID(),
    customerName: 'Digisailor Dev Environment',
    edition: 'ENTERPRISE',
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    gracePeriodDays: 14,
    limits: {
      maxClients: -1,
      maxOpsUsers: -1,
      maxPortalUsers: -1,
      maxWarehouses: -1,
    },
    features: ['core', 'billing', 'vas', 'rma', 'edi', 'api_access', 'reports'],
  };

  const licenseKey = jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    noTimestamp: true,
  });

  await prisma.license.create({
    data: {
      licenseKey,
      activatedBy: null,
      active: true,
    },
  });

  console.log('Dev license created. Set LICENSE_PUBLIC_KEY in .env:');
  console.log(publicKey.replace(/\n/g, '\\n'));
}

async function ensureWarehouse(): Promise<string> {
  const warehouse = await prisma.warehouse.upsert({
    where: { code: 'WH001' },
    update: { name: 'Main Distribution Center', active: true },
    create: {
      code: 'WH001',
      name: 'Main Distribution Center',
      address: {
        line1: '100 Logistics Park',
        city: 'Chennai',
        state: 'TN',
        postalCode: '600001',
        country: 'IN',
      },
      active: true,
    },
  });

  const zoneDefs: Array<{
    code: string;
    name: string;
    type: ZoneType;
    tempClass: TempClass;
  }> = [
    { code: 'RCV', name: 'Receiving', type: ZoneType.RECEIVING, tempClass: TempClass.AMBIENT },
    { code: 'RSV', name: 'Reserve', type: ZoneType.RESERVE, tempClass: TempClass.AMBIENT },
    { code: 'PCK', name: 'Pick', type: ZoneType.PICK, tempClass: TempClass.AMBIENT },
    { code: 'PAK', name: 'Pack', type: ZoneType.PACK, tempClass: TempClass.AMBIENT },
    { code: 'STG', name: 'Staging', type: ZoneType.STAGING, tempClass: TempClass.AMBIENT },
  ];

  const zones: Record<string, string> = {};
  for (const z of zoneDefs) {
    const zone = await prisma.zone.upsert({
      where: { warehouseId_code: { warehouseId: warehouse.id, code: z.code } },
      update: { name: z.name, type: z.type, tempClass: z.tempClass },
      create: {
        warehouseId: warehouse.id,
        code: z.code,
        name: z.name,
        type: z.type,
        tempClass: z.tempClass,
        hazmatAllowed: false,
      },
    });
    zones[z.code] = zone.id;
  }

  const existingLocs = await prisma.location.count({ where: { warehouseId: warehouse.id } });
  if (existingLocs < 40) {
    let seq = 1;
    const locations: Array<{
      zoneId: string;
      warehouseId: string;
      code: string;
      type: LocationType;
      pickSequence: number | null;
      active: boolean;
    }> = [];

    // 4 receiving docks
    for (let i = 1; i <= 4; i++) {
      locations.push({
        zoneId: zones.RCV,
        warehouseId: warehouse.id,
        code: `RCV-D${i}`,
        type: LocationType.DOCK,
        pickSequence: null,
        active: true,
      });
    }
    // 16 reserve
    for (let a = 1; a <= 4; a++) {
      for (let b = 1; b <= 4; b++) {
        locations.push({
          zoneId: zones.RSV,
          warehouseId: warehouse.id,
          code: `RSV-A${a}-B${b}`,
          type: LocationType.RESERVE,
          pickSequence: null,
          active: true,
        });
      }
    }
    // 12 pick faces
    for (let i = 1; i <= 12; i++) {
      locations.push({
        zoneId: zones.PCK,
        warehouseId: warehouse.id,
        code: `PCK-${String(i).padStart(2, '0')}`,
        type: LocationType.PICK_FACE,
        pickSequence: seq++,
        active: true,
      });
    }
    // 4 pack + 4 staging
    for (let i = 1; i <= 4; i++) {
      locations.push({
        zoneId: zones.PAK,
        warehouseId: warehouse.id,
        code: `PAK-${i}`,
        type: LocationType.STAGING,
        pickSequence: null,
        active: true,
      });
      locations.push({
        zoneId: zones.STG,
        warehouseId: warehouse.id,
        code: `STG-${i}`,
        type: LocationType.STAGING,
        pickSequence: null,
        active: true,
      });
    }

    for (const loc of locations) {
      await prisma.location.upsert({
        where: { code: loc.code },
        update: {
          zoneId: loc.zoneId,
          type: loc.type,
          pickSequence: loc.pickSequence,
          active: true,
        },
        create: loc,
      });
    }
  }

  return warehouse.id;
}

async function ensureClient(
  code: string,
  legalName: string,
  portalEmail: string,
  portalName: string,
): Promise<string> {
  const client = await prisma.client.upsert({
    where: { code },
    update: {
      legalName,
      status: ClientStatus.ACTIVE,
      config: {
        allocationStrategy: 'FEFO',
        adjustmentAutoApproveThreshold: 10,
      },
      branding: {
        companyName: legalName,
        primaryColor: code === 'DEMO-A' ? '#0d9488' : '#2563eb',
      },
    },
    create: {
      code,
      legalName,
      status: ClientStatus.ACTIVE,
      config: {
        allocationStrategy: 'FEFO',
        adjustmentAutoApproveThreshold: 10,
      },
      branding: {
        companyName: legalName,
        primaryColor: code === 'DEMO-A' ? '#0d9488' : '#2563eb',
      },
    },
  });

  const passwordHash = await bcrypt.hash('portal123', 10);
  await prisma.portalUser.upsert({
    where: { email: portalEmail },
    update: {
      passwordHash,
      name: portalName,
      role: PortalRole.CLIENT_ADMIN,
      active: true,
      clientId: client.id,
    },
    create: {
      clientId: client.id,
      email: portalEmail,
      passwordHash,
      name: portalName,
      role: PortalRole.CLIENT_ADMIN,
      active: true,
    },
  });

  const itemCount = await prisma.item.count({ where: { clientId: client.id } });
  if (itemCount < 8) {
    const items = [
      {
        sku: `${code}-SKU-001`,
        description: 'Premium Widget A',
        lotTracked: true,
        shelfLifeDays: 365,
        minShipShelfPct: 50,
      },
      {
        sku: `${code}-SKU-002`,
        description: 'Premium Widget B',
        lotTracked: true,
        shelfLifeDays: 180,
        minShipShelfPct: 40,
      },
      {
        sku: `${code}-SKU-003`,
        description: 'Bulk Fastener Pack',
        lotTracked: false,
        shelfLifeDays: null,
        minShipShelfPct: null,
      },
      {
        sku: `${code}-SKU-004`,
        description: 'Chilled Dairy Mix',
        lotTracked: true,
        shelfLifeDays: 30,
        minShipShelfPct: 60,
        tempClass: TempClass.CHILLED,
      },
      {
        sku: `${code}-SKU-005`,
        description: 'Standard Carton Box',
        lotTracked: false,
        shelfLifeDays: null,
        minShipShelfPct: null,
      },
      {
        sku: `${code}-SKU-006`,
        description: 'Electronic Component Kit',
        lotTracked: true,
        shelfLifeDays: 730,
        minShipShelfPct: 30,
      },
      {
        sku: `${code}-SKU-007`,
        description: 'Apparel Assortment',
        lotTracked: false,
        shelfLifeDays: null,
        minShipShelfPct: null,
      },
      {
        sku: `${code}-SKU-008`,
        description: 'Frozen Meal Pack',
        lotTracked: true,
        shelfLifeDays: 90,
        minShipShelfPct: 50,
        tempClass: TempClass.FROZEN,
      },
    ];

    for (const item of items) {
      await prisma.item.upsert({
        where: { clientId_sku: { clientId: client.id, sku: item.sku } },
        update: {
          description: item.description,
          lotTracked: item.lotTracked,
          shelfLifeDays: item.shelfLifeDays,
          minShipShelfPct: item.minShipShelfPct,
          tempClass: item.tempClass ?? TempClass.AMBIENT,
          active: true,
        },
        create: {
          clientId: client.id,
          sku: item.sku,
          description: item.description,
          uom: 'EA',
          packConfig: { unitsPerCase: 12, casesPerPallet: 40 },
          lotTracked: item.lotTracked,
          serialTracked: false,
          shelfLifeDays: item.shelfLifeDays,
          minShipShelfPct: item.minShipShelfPct,
          tempClass: item.tempClass ?? TempClass.AMBIENT,
          active: true,
        },
      });
    }
  }

  return client.id;
}

async function ensureOperationalData(clientCode: string): Promise<void> {
  const client = await prisma.client.findUnique({ where: { code: clientCode } });
  const warehouse = await prisma.warehouse.findUnique({ where: { code: 'WH001' } });
  if (!client || !warehouse) return;

  const existingLots = await prisma.inventoryLot.count({ where: { clientId: client.id } });
  if (existingLots > 0) return;

  const items = await prisma.item.findMany({
    where: { clientId: client.id, active: true },
    orderBy: { sku: 'asc' },
  });
  const pickLocations = await prisma.location.findMany({
    where: { warehouseId: warehouse.id, type: LocationType.PICK_FACE, active: true },
    orderBy: { pickSequence: 'asc' },
    take: 8,
  });
  if (items.length === 0 || pickLocations.length === 0) return;

  const now = new Date();
  const early = new Date(now);
  early.setDate(early.getDate() + 25);
  const late = new Date(now);
  late.setDate(late.getDate() + 120);

  // Create ASN + received lines + AVAILABLE lots with ledger
  const receipt = await prisma.inboundReceipt.create({
    data: {
      clientId: client.id,
      warehouseId: warehouse.id,
      asnNumber: `ASN-${clientCode}-SEED`,
      status: ReceiptStatus.COMPLETE,
      expectedDate: now,
      arrivedAt: now,
      completedAt: now,
      carrierName: 'Demo Carrier',
      lines: {
        create: items.slice(0, 4).map((item, idx) => ({
          clientId: client.id,
          itemId: item.id,
          expectedQty: new Prisma.Decimal(100),
          receivedQty: new Prisma.Decimal(100),
          damagedQty: new Prisma.Decimal(0),
          shortQty: new Prisma.Decimal(0),
          lotNumber: item.lotTracked ? `LOT-${clientCode}-${idx + 1}` : null,
          expiryDate: item.lotTracked ? (idx % 2 === 0 ? early : late) : null,
        })),
      },
    },
    include: { lines: true },
  });

  for (let i = 0; i < receipt.lines.length; i++) {
    const line = receipt.lines[i];
    const item = items.find((it) => it.id === line.itemId);
    if (!item) continue;
    const location = pickLocations[i % pickLocations.length];
    const qty = new Prisma.Decimal(100);

    const lot = await prisma.inventoryLot.create({
      data: {
        clientId: client.id,
        itemId: item.id,
        warehouseId: warehouse.id,
        locationId: location.id,
        lpn: `LPN-${clientCode}-${String(i + 1).padStart(3, '0')}`,
        lotNumber: line.lotNumber,
        expiryDate: line.expiryDate,
        qtyOnHand: qty,
        qtyAllocated: new Prisma.Decimal(0),
        status: LotStatus.AVAILABLE,
        receivedAt: now,
        receiptLineId: line.id,
      },
    });

    await prisma.inventoryTransaction.create({
      data: {
        clientId: client.id,
        txnType: TxnType.RECEIPT,
        itemId: item.id,
        lotId: lot.id,
        qtyDelta: qty,
        statusFrom: null,
        statusTo: LotStatus.RECEIVED,
        refType: 'InboundReceipt',
        refId: receipt.id,
        notes: 'Seed receipt',
        occurredAt: now,
      },
    });
    await prisma.inventoryTransaction.create({
      data: {
        clientId: client.id,
        txnType: TxnType.PUTAWAY,
        itemId: item.id,
        lotId: lot.id,
        toLocationId: location.id,
        qtyDelta: new Prisma.Decimal(0),
        statusFrom: LotStatus.RECEIVED,
        statusTo: LotStatus.AVAILABLE,
        refType: 'InboundReceipt',
        refId: receipt.id,
        notes: 'Seed putaway',
        occurredAt: now,
      },
    });
  }

  // Open orders for dashboard/outbound screens
  const orderItem = items[0];
  if (orderItem) {
    await prisma.outboundOrder.create({
      data: {
        clientId: client.id,
        warehouseId: warehouse.id,
        externalRef: `ORD-${clientCode}-OPEN-1`,
        status: OrderStatus.RECEIVED,
        priority: 5,
        slaShipBy: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
        shipTo: {
          name: `${clientCode} Consignee`,
          phone: '+91-9000000000',
          address: {
            line1: '22 Demo Street',
            city: 'Chennai',
            state: 'TN',
            postalCode: '600002',
            country: 'IN',
          },
        },
        lines: {
          create: [
            {
              clientId: client.id,
              itemId: orderItem.id,
              orderedQty: new Prisma.Decimal(25),
            },
          ],
        },
      },
    });
  }

  // Expected inbound for inbound list
  await prisma.inboundReceipt.create({
    data: {
      clientId: client.id,
      warehouseId: warehouse.id,
      asnNumber: `ASN-${clientCode}-EXPECTED`,
      status: ReceiptStatus.EXPECTED,
      expectedDate: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      carrierName: 'Future Freight',
      lines: {
        create: items.slice(0, 2).map((item) => ({
          clientId: client.id,
          itemId: item.id,
          expectedQty: new Prisma.Decimal(50),
        })),
      },
    },
  });
}

/** Scale up sample data once baseline ops seed exists. Idempotent via count gates. */
async function ensureBulkSampleData(clientCode: string): Promise<void> {
  const client = await prisma.client.findUnique({ where: { code: clientCode } });
  const warehouse = await prisma.warehouse.findUnique({ where: { code: 'WH001' } });
  if (!client || !warehouse) return;

  const items = await prisma.item.findMany({
    where: { clientId: client.id, active: true },
    orderBy: { sku: 'asc' },
  });
  const locations = await prisma.location.findMany({
    where: { warehouseId: warehouse.id, active: true, type: { in: [LocationType.PICK_FACE, LocationType.RESERVE] } },
    orderBy: { code: 'asc' },
  });
  if (items.length === 0 || locations.length === 0) return;

  const now = new Date();
  const admin = await prisma.opsUser.findUnique({ where: { email: 'admin@wms.local' } });
  const actorId = admin?.id ?? null;

  const lotCount = await prisma.inventoryLot.count({ where: { clientId: client.id } });
  const targetLots = 80;

  // Extra AVAILABLE lots across all SKUs until target
  if (lotCount < targetLots) {
    const lotCreates: Prisma.InventoryLotCreateManyInput[] = [];
    const txnCreates: Prisma.InventoryTransactionCreateManyInput[] = [];
    let lotSeq = lotCount + 1;
    const toCreate = targetLots - lotCount;

    for (let n = 0; n < toCreate; n++) {
      const item = items[n % items.length];
      const loc = locations[n % locations.length];
      const expiry = item.lotTracked
        ? new Date(now.getTime() + (20 + (n % 8) * 45) * 24 * 60 * 60 * 1000)
        : null;
      const qty = 40 + (n % 5) * 20;
      const tempId = randomUUID();
      lotCreates.push({
        id: tempId,
        clientId: client.id,
        itemId: item.id,
        warehouseId: warehouse.id,
        locationId: loc.id,
        lpn: `LPN-${clientCode}-B${String(lotSeq).padStart(4, '0')}`,
        lotNumber: item.lotTracked ? `LOT-${clientCode}-B${lotSeq}` : null,
        expiryDate: expiry,
        qtyOnHand: new Prisma.Decimal(qty),
        qtyAllocated: new Prisma.Decimal(0),
        status: LotStatus.AVAILABLE,
        receivedAt: new Date(now.getTime() - (n % 12) * 3600_000),
      });
      txnCreates.push({
        clientId: client.id,
        txnType: TxnType.RECEIPT,
        itemId: item.id,
        lotId: tempId,
        qtyDelta: new Prisma.Decimal(qty),
        statusTo: LotStatus.AVAILABLE,
        refType: 'Seed',
        notes: 'Bulk seed stock',
        occurredAt: new Date(now.getTime() - (n % 12) * 3600_000),
        actorId,
      });
      lotSeq += 1;
    }

    if (lotCreates.length > 0) {
      await prisma.inventoryLot.createMany({ data: lotCreates });
      await prisma.inventoryTransaction.createMany({ data: txnCreates });
    }
  }

  // More ASNs (mix of statuses) — bulk + extra wave
  const receiptStatuses: ReceiptStatus[] = [
    ReceiptStatus.EXPECTED,
    ReceiptStatus.ARRIVED,
    ReceiptStatus.RECEIVING,
    ReceiptStatus.EXPECTED,
    ReceiptStatus.ARRIVED,
    ReceiptStatus.RECEIVING,
    ReceiptStatus.EXPECTED,
    ReceiptStatus.COMPLETE,
  ];
  for (let r = 0; r < receiptStatuses.length; r++) {
    const status = receiptStatuses[r];
    const asn = `ASN-${clientCode}-BULK-${r + 1}`;
    const exists = await prisma.inboundReceipt.findFirst({
      where: { clientId: client.id, asnNumber: asn },
    });
    if (exists) continue;
    await prisma.inboundReceipt.create({
      data: {
        clientId: client.id,
        warehouseId: warehouse.id,
        asnNumber: asn,
        status,
        expectedDate: new Date(now.getTime() + (r + 1) * 24 * 60 * 60 * 1000),
        arrivedAt: status === ReceiptStatus.EXPECTED ? null : now,
        carrierName: r % 2 === 0 ? 'BlueDart Logistics' : 'Delhivery Freight',
        vehicleRef: `TN-09-AB-${1000 + r}`,
        lines: {
          create: items.slice(0, 3).map((item, idx) => ({
            clientId: client.id,
            itemId: item.id,
            expectedQty: new Prisma.Decimal(30 + idx * 10),
            receivedQty:
              status === ReceiptStatus.RECEIVING || status === ReceiptStatus.COMPLETE
                ? new Prisma.Decimal(10 + idx * 5)
                : new Prisma.Decimal(0),
          })),
        },
      },
    });
  }

  // More outbound orders across statuses
  const orderStatuses = [
    OrderStatus.RECEIVED,
    OrderStatus.VALIDATED,
    OrderStatus.ALLOCATED,
    OrderStatus.PICKING,
    OrderStatus.PACKED,
    OrderStatus.SHIPPED,
    OrderStatus.BACKORDERED,
    OrderStatus.CANCELLED,
  ];
  const orderSpecs: Array<{ ref: string; status: OrderStatus; priority: number; qty: number }> = [
    { ref: `ORD-${clientCode}-OPEN-2`, status: OrderStatus.RECEIVED, priority: 3, qty: 15 },
    { ref: `ORD-${clientCode}-OPEN-3`, status: OrderStatus.VALIDATED, priority: 5, qty: 40 },
    { ref: `ORD-${clientCode}-ALLOC-1`, status: OrderStatus.ALLOCATED, priority: 4, qty: 20 },
    { ref: `ORD-${clientCode}-PICK-1`, status: OrderStatus.PICKING, priority: 2, qty: 12 },
    { ref: `ORD-${clientCode}-PACK-1`, status: OrderStatus.PACKED, priority: 6, qty: 8 },
    { ref: `ORD-${clientCode}-SHIP-1`, status: OrderStatus.SHIPPED, priority: 5, qty: 30 },
    { ref: `ORD-${clientCode}-BACK-1`, status: OrderStatus.BACKORDERED, priority: 7, qty: 50 },
    ...Array.from({ length: 12 }, (_, i) => ({
      ref: `ORD-${clientCode}-XTRA-${i + 1}`,
      status: orderStatuses[i % orderStatuses.length],
      priority: 1 + (i % 9),
      qty: 10 + i * 3,
    })),
  ];

  for (let o = 0; o < orderSpecs.length; o++) {
    const spec = orderSpecs[o];
    const exists = await prisma.outboundOrder.findUnique({
      where: { clientId_externalRef: { clientId: client.id, externalRef: spec.ref } },
    });
    if (exists) continue;
    const lineItems = items.slice(0, 2 + (o % 3));
    await prisma.outboundOrder.create({
      data: {
        clientId: client.id,
        warehouseId: warehouse.id,
        externalRef: spec.ref,
        status: spec.status,
        priority: spec.priority,
        slaShipBy: new Date(now.getTime() + (o + 1) * 12 * 60 * 60 * 1000),
        shipTo: {
          name: `${clientCode} Customer ${o + 1}`,
          phone: `+91-98${String(10000000 + o).slice(0, 8)}`,
          email: `ship${o}@${clientCode.toLowerCase()}.demo`,
          address: {
            line1: `${10 + o} Industrial Avenue`,
            city: o % 2 === 0 ? 'Chennai' : 'Bengaluru',
            state: o % 2 === 0 ? 'TN' : 'KA',
            postalCode: o % 2 === 0 ? '600018' : '560001',
            country: 'IN',
          },
        },
        notes: `Bulk seed order ${spec.ref}`,
        lines: {
          create: lineItems.map((item, idx) => ({
            clientId: client.id,
            itemId: item.id,
            orderedQty: new Prisma.Decimal(spec.qty + idx * 5),
            pickedQty:
              spec.status === OrderStatus.PICKING ||
              spec.status === OrderStatus.PACKED ||
              spec.status === OrderStatus.SHIPPED
                ? new Prisma.Decimal(Math.floor(spec.qty / 2))
                : new Prisma.Decimal(0),
            packedQty:
              spec.status === OrderStatus.PACKED || spec.status === OrderStatus.SHIPPED
                ? new Prisma.Decimal(Math.floor(spec.qty / 2))
                : new Prisma.Decimal(0),
            backorderedQty:
              spec.status === OrderStatus.BACKORDERED
                ? new Prisma.Decimal(10)
                : new Prisma.Decimal(0),
          })),
        },
      },
    });
  }

  // Dock appointments
  for (let d = 0; d < 4; d++) {
    const dockCode = `RCV-D${(d % 4) + 1}`;
    const scheduledAt = new Date(now.getTime() + d * 2 * 60 * 60 * 1000);
    const exists = await prisma.dockAppointment.findFirst({
      where: { warehouseId: warehouse.id, dockCode, scheduledAt },
    });
    if (exists) continue;
    await prisma.dockAppointment.create({
      data: {
        warehouseId: warehouse.id,
        dockCode,
        scheduledAt,
        durationMinutes: 60,
        carrierName: d % 2 === 0 ? 'TCI Freight' : 'Gati',
        vehicleRef: `VEH-${clientCode}-${d + 1}`,
        driverName: `Driver ${d + 1}`,
        driverPhone: `+91-90${String(20000000 + d).slice(0, 8)}`,
        status: d === 0 ? AppointmentStatus.CHECKED_IN : AppointmentStatus.SCHEDULED,
        checkedInAt: d === 0 ? now : null,
      },
    });
  }

  // Active holds + adjustments for inventory screens
  if (actorId) {
    const holdTypes = [HoldType.QC_HOLD, HoldType.CLIENT_HOLD, HoldType.RECALL_HOLD];
    const sampleLots = await prisma.inventoryLot.findMany({
      where: { clientId: client.id, status: LotStatus.AVAILABLE },
      orderBy: { createdAt: 'asc' },
      take: 6,
    });
    for (let h = 0; h < sampleLots.length; h++) {
      const lot = sampleLots[h];
      const holdExists = await prisma.inventoryHold.findFirst({
        where: { clientId: client.id, lotId: lot.id, active: true },
      });
      if (holdExists) continue;
      await prisma.inventoryHold.create({
        data: {
          clientId: client.id,
          itemId: lot.itemId,
          lotId: lot.id,
          holdType: holdTypes[h % holdTypes.length],
          reason: `Seed hold ${h + 1}: inspection / client request`,
          heldBy: actorId,
          active: true,
        },
      });
    }

    const adjStatuses = [
      AdjustmentStatus.PENDING_APPROVAL,
      AdjustmentStatus.APPROVED,
      AdjustmentStatus.REJECTED,
      AdjustmentStatus.PENDING_APPROVAL,
    ];
    for (let a = 0; a < Math.min(4, sampleLots.length); a++) {
      const lot = sampleLots[a];
      const notes = `Seed adjustment batch ${a + 1}`;
      const adjExists = await prisma.adjustment.findFirst({
        where: { clientId: client.id, notes },
      });
      if (adjExists) continue;
      const delta = a % 2 === 0 ? -3 - a : 2 + a;
      await prisma.adjustment.create({
        data: {
          clientId: client.id,
          itemId: lot.itemId,
          lotId: lot.id,
          locationId: lot.locationId,
          qtyDelta: new Prisma.Decimal(delta),
          reasonCode: a % 2 === 0 ? 'CYCLE_COUNT' : 'DAMAGE',
          notes,
          status: adjStatuses[a],
          requestedBy: actorId,
          approvedBy: adjStatuses[a] === AdjustmentStatus.PENDING_APPROVAL ? null : actorId,
          approvedAt: adjStatuses[a] === AdjustmentStatus.PENDING_APPROVAL ? null : now,
        },
      });
    }
  }

  // Planning wave with a couple of open orders attached (if none)
  const waveName = `WAVE-${clientCode}-SEED`;
  let wave = await prisma.wave.findFirst({ where: { warehouseId: warehouse.id, name: waveName } });
  if (!wave && actorId) {
    wave = await prisma.wave.create({
      data: {
        warehouseId: warehouse.id,
        name: waveName,
        status: WaveStatus.PLANNING,
        createdBy: actorId,
      },
    });
    const openOrders = await prisma.outboundOrder.findMany({
      where: {
        clientId: client.id,
        status: { in: [OrderStatus.RECEIVED, OrderStatus.VALIDATED] },
        waveId: null,
      },
      take: 2,
    });
    for (const ord of openOrders) {
      await prisma.outboundOrder.update({
        where: { id: ord.id },
        data: { waveId: wave.id },
      });
    }
  }
}

async function ensureBillingData(clientId: string, code: string): Promise<void> {
  const rateCard = await prisma.rateCard.upsert({
    where: { clientId },
    update: {
      currency: 'INR',
      storagePerUnitDay: new Prisma.Decimal('0.15'),
      pickPerUnit: new Prisma.Decimal('2.00'),
      packPerOrder: new Prisma.Decimal('12.00'),
      shipPerShipment: new Prisma.Decimal('25.00'),
      vasRates: { RELABEL: '2.50', KITTING: '15.00', PHOTO: '1.00' },
      active: true,
    },
    create: {
      clientId,
      currency: 'INR',
      storagePerUnitDay: new Prisma.Decimal('0.15'),
      pickPerUnit: new Prisma.Decimal('2.00'),
      packPerOrder: new Prisma.Decimal('12.00'),
      shipPerShipment: new Prisma.Decimal('25.00'),
      vasRates: { RELABEL: '2.50', KITTING: '15.00', PHOTO: '1.00' },
      active: true,
    },
  });

  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  const key = `${periodStart.toISOString().slice(0, 10)}_${periodEnd.toISOString().slice(0, 10)}`;
  const days =
    Math.floor((periodEnd.getTime() - periodStart.getTime()) / 86_400_000) + 1;

  const unitsAgg = await prisma.inventoryLot.aggregate({
    where: { clientId, qtyOnHand: { gt: 0 } },
    _sum: { qtyOnHand: true },
  });
  const unitsOnHand = new Prisma.Decimal(unitsAgg._sum.qtyOnHand ?? 0);
  const storageQty = unitsOnHand.mul(days);

  if (storageQty.gt(0)) {
    await prisma.charge.upsert({
      where: {
        clientId_chargeType_sourceRef: {
          clientId,
          chargeType: 'STORAGE',
          sourceRef: `storage:${key}`,
        },
      },
      update: {},
      create: {
        clientId,
        chargeType: 'STORAGE',
        description: `Storage ${unitsOnHand.toString()} units × ${days} days`,
        quantity: storageQty,
        unitRate: rateCard.storagePerUnitDay,
        amount: storageQty.mul(rateCard.storagePerUnitDay).toDecimalPlaces(4),
        periodStart,
        periodEnd,
        sourceRef: `storage:${key}`,
        status: 'DRAFT',
        meta: { clientCode: code, seeded: true },
      },
    });
  }

  const periodEndExclusive = new Date(periodEnd);
  periodEndExclusive.setUTCDate(periodEndExclusive.getUTCDate() + 1);

  const pickAgg = await prisma.inventoryTransaction.aggregate({
    where: {
      clientId,
      txnType: TxnType.PICK,
      occurredAt: { gte: periodStart, lt: periodEndExclusive },
    },
    _sum: { qtyDelta: true },
  });
  const pickUnits = new Prisma.Decimal(pickAgg._sum.qtyDelta ?? 0).abs();
  if (pickUnits.gt(0)) {
    await prisma.charge.upsert({
      where: {
        clientId_chargeType_sourceRef: {
          clientId,
          chargeType: 'PICK',
          sourceRef: `pick:${key}`,
        },
      },
      update: {},
      create: {
        clientId,
        chargeType: 'PICK',
        description: `Picks ${pickUnits.toString()} units`,
        quantity: pickUnits,
        unitRate: rateCard.pickPerUnit,
        amount: pickUnits.mul(rateCard.pickPerUnit).toDecimalPlaces(4),
        periodStart,
        periodEnd,
        sourceRef: `pick:${key}`,
        status: 'DRAFT',
        meta: { clientCode: code, seeded: true },
      },
    });
  }

  const shippedCount = await prisma.outboundOrder.count({
    where: {
      clientId,
      status: OrderStatus.SHIPPED,
      updatedAt: { gte: periodStart, lt: periodEndExclusive },
    },
  });
  if (shippedCount > 0) {
    await prisma.charge.upsert({
      where: {
        clientId_chargeType_sourceRef: {
          clientId,
          chargeType: 'SHIP',
          sourceRef: `ship:${key}`,
        },
      },
      update: {},
      create: {
        clientId,
        chargeType: 'SHIP',
        description: `Ship ${shippedCount} orders`,
        quantity: new Prisma.Decimal(shippedCount),
        unitRate: rateCard.shipPerShipment,
        amount: new Prisma.Decimal(shippedCount)
          .mul(rateCard.shipPerShipment)
          .toDecimalPlaces(4),
        periodStart,
        periodEnd,
        sourceRef: `ship:${key}`,
        status: 'DRAFT',
        meta: { clientCode: code, seeded: true },
      },
    });
  }

  // Issue a sample invoice for DEMO-A only (first seed)
  if (code !== 'DEMO-A') return;

  const existingIssued = await prisma.invoice.findFirst({
    where: { clientId, status: 'ISSUED' },
  });
  if (existingIssued) return;

  const draftCharges = await prisma.charge.findMany({
    where: { clientId, status: 'DRAFT' },
    take: 2,
    orderBy: { createdAt: 'asc' },
  });
  if (draftCharges.length === 0) return;

  const subtotal = draftCharges.reduce(
    (sum, c) => sum.add(c.amount),
    new Prisma.Decimal(0),
  );
  const ym = `${periodStart.getUTCFullYear()}${String(periodStart.getUTCMonth() + 1).padStart(2, '0')}`;
  const invoiceNo = `INV-${ym}-0001`;

  await prisma.invoice.create({
    data: {
      clientId,
      invoiceNo,
      periodStart,
      periodEnd,
      subtotal,
      taxAmount: new Prisma.Decimal(0),
      total: subtotal,
      status: 'ISSUED',
      issuedAt: new Date(),
      notes: 'Seeded sample invoice',
      lines: {
        create: draftCharges.map((c) => ({
          clientId,
          chargeId: c.id,
          description: c.description,
          amount: c.amount,
        })),
      },
    },
  });
  await prisma.charge.updateMany({
    where: { id: { in: draftCharges.map((c) => c.id) } },
    data: { status: 'INVOICED' },
  });
}

async function main(): Promise<void> {
  const started = performance.now();
  console.log('Seeding database...');

  // Session-level ops role so FORCE RLS allows tenant-table writes during seed
  await prisma.$executeRawUnsafe(
    `SELECT set_config('app.actor_role', 'warehouse_ops', false)`,
  );

  await upsertOpsUser('admin@wms.local', 'admin123', 'System Admin', OpsRole.ADMIN);
  await upsertOpsUser(
    'supervisor@wms.local',
    'admin123',
    'Floor Supervisor',
    OpsRole.SUPERVISOR,
  );

  await ensureWarehouse();
  const clientA = await ensureClient(
    'DEMO-A',
    'Demo Client Alpha Pvt Ltd',
    'portala@demo.com',
    'Portal User A',
  );
  const clientB = await ensureClient(
    'DEMO-B',
    'Demo Client Beta Pvt Ltd',
    'portalb@demo.com',
    'Portal User B',
  );
  await ensureDevLicense();

  const opsStarted = performance.now();
  await ensureOperationalData('DEMO-A');
  await ensureOperationalData('DEMO-B');
  await ensureBulkSampleData('DEMO-A');
  await ensureBulkSampleData('DEMO-B');
  await ensureBillingData(clientA, 'DEMO-A');
  await ensureBillingData(clientB, 'DEMO-B');
  const opsMs = performance.now() - opsStarted;

  const elapsedMs = performance.now() - started;
  console.log('Seed complete.');
  console.log(`  Timing: total ${elapsedMs.toFixed(0)}ms (operational/bulk ${opsMs.toFixed(0)}ms)`);
  console.log('  Ops:    admin@wms.local / admin123');
  console.log('  Ops:    supervisor@wms.local / admin123');
  console.log('  Portal: portala@demo.com / portal123');
  console.log('  Portal: portalb@demo.com / portal123');
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
