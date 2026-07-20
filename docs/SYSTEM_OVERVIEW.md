# Digisailor 3PL WMS — System Overview

## 1. Product summary

**Digisailor 3PL WMS** is a multi-tenant warehouse management system for third-party logistics operators.

| Actor | App | Role |
|--------|-----|------|
| 3PL operator | **Ops Web** (`ops-web`) | Run the warehouse for all clients |
| Brand / shipper | **Client Portal** (`portal-web`) | See their stock, create orders/ASNs, invoices |
| System | **API** (`api`) | Shared NestJS backend |

**Tenancy model:** one operator, many `Client`s. Portal users belong to one client. End customers are **ship-to on orders**, not tenants.

---

## 2. Tech stack

| Layer | Technology |
|--------|------------|
| Monorepo | npm workspaces + **Turborepo** |
| Language | **TypeScript** (Node ≥ 20) |
| API | **NestJS 10** + **Fastify** |
| Auth | **JWT** (ops + portal realms), NextAuth on frontends |
| ORM / DB | **Prisma 5** + **PostgreSQL 16** (RLS by `client_id`) |
| Cache / queue | **Valkey** (Redis-compatible); cron via `@nestjs/schedule` |
| Object storage | **MinIO** (S3-compatible; GCS/S3 adapters exist) |
| Ops UI | **Next.js 14** (App Router), React Query, Tailwind, shadcn-style UI |
| Portal UI | Same stack; branded shell (Syne / Source Sans 3) |
| Shared packages | `@wms/types`, `@wms/zod-schemas`, `@wms/db` |
| Validation | **Zod** (+ Nest pipes / class-validator where used) |
| License | Feature-gated editions (`core`, `billing`, `vas`, `rma`, `edi`, …) |
| Infra (dev) | Docker Compose: Postgres, Valkey, MinIO |

### Typical local ports

| Service | Port |
|---------|------|
| API | `4000` (`/api/v1`, Swagger `/api/docs`) |
| Ops Web | `3000` |
| Portal Web | `3001` |
| Postgres (dev compose) | `5433` → container `5432` |
| MinIO | `9000` |

---

## 3. Repository layout

```
apps/
  api/           NestJS API
  ops-web/       Operator WMS UI
  portal-web/    Client portal UI
packages/
  db/            Prisma schema, migrations, seed
  types/         Shared enums, DTOs, license types
  zod-schemas/   Request validation schemas
infrastructure/
  docker/        docker-compose.dev.yml / docker-compose.yml
docs/
  SYSTEM_OVERVIEW.md   This document
```

---

## 4. Architecture

```
┌─────────────┐     ┌─────────────┐
│  ops-web    │     │ portal-web  │
│  :3000      │     │  :3001      │
└──────┬──────┘     └──────┬──────┘
       │ JWT (OPS)         │ JWT (PORTAL + clientId)
       └─────────┬─────────┘
                 ▼
         ┌───────────────┐
         │  NestJS API   │
         │  :4000/api/v1 │
         └───────┬───────┘
                 │
     ┌───────────┼───────────┐
     ▼           ▼           ▼
 Postgres    Valkey      MinIO
 (RLS)       (cache)     (files)
```

### Key patterns

- **Dual auth realms:** `OPS` vs `PORTAL` in JWT; portal always scoped by `clientId`.
- **Tenant isolation:** Postgres **RLS**; API uses `TenantPrismaService.withTenant(clientId)` / `withOpsRole()`.
- **License gates:** `@RequiresFeature('billing'|…)` on commercial modules.
- **Shared domain services:** Portal often reuses inbound/outbound/inventory services with tenant context.
- **Infrastructure adapters:** storage (MinIO/S3/GCS), mail (SMTP/Resend/SES), optional BullMQ vs cron.

---

## 5. API modules

| Module | Purpose | Maturity |
|--------|---------|----------|
| **auth** | Ops + portal login, refresh | Real |
| **client** | Clients, contracts, SLA, portal users, config | Real |
| **warehouse** | Warehouses, zones, locations, utilization | Real (configurator UI thin) |
| **item** | SKU master, import | Real |
| **inbound** | ASN/receipts, receive, putaway, dock appointments | Real |
| **outbound** | Orders, allocate, waves, pick, cartons, ship | Real |
| **inventory** | Lots, holds, adjustments, ledger | Real |
| **portal** | Dashboard stats, analytics, warehouses alias | Real |
| **document** | Portal doc list/download (URL-derived) | Thin |
| **dashboard** | Ops live stats | Real |
| **reports** | Stock, SLA, aging, ledger | Real / thin set |
| **billing** | Rate cards, meter, charges, invoices | Real |
| **notifications** | Recent events + mail test | Partial (ephemeral) |
| **ops-user** | Operator users | Real |
| **license** | Activate / feature checks | Real |
| **health** | Health check | Real |
| **VAS / RMA / EDI** (under billing routes) | Placeholders | Stub |

---

## 6. Ops Web (admin) modules

| Area | Routes / features |
|------|-------------------|
| Dashboard | Live KPIs, activity |
| Clients | CRUD, contracts/SLA, portal users |
| Warehouses | List/detail, zones, utilization |
| Items | Catalog |
| Inbound | Receipts, appointments, putaway |
| Inventory | Lots, holds, adjustments, ledger |
| Outbound | Orders, waves, pick tasks, shipments |
| Cycle count | Thin (adjustment-based) |
| Billing | Summary, charges, invoices, rate card, meter |
| VAS / RMA / EDI | Stub UIs |
| Reports | Stock, SLA, aging, ledger |
| Settings | Users, license, notifications |

---

## 7. Portal Web modules

| Area | Features |
|------|----------|
| Dashboard | KPIs, recent orders, fast movers, expiring lots |
| Analytics | Movement, aging, stock by status (14/30/60d) |
| Inventory | Live lots, CSV export |
| Orders | Create/list/detail (ship-to on order) |
| Inbound | Create/list ASN detail |
| Documents | Labels/POD/ASN-related downloads |
| Invoices | Issued invoices (billing feature) |
| Branding | Per-client color / company name |

**Portal roles:** `CLIENT_ADMIN`, `ORDER_ENTRY`, `VIEWER`.

---

## 8. Domain model (high level)

**Operator:** `OpsUser`, `License`, `Warehouse` → `Zone` → `Location`

**Tenant (`Client`):**  
`PortalUser`, `Item`, `InventoryLot`, `InventoryTransaction`, `InventoryHold`, `Adjustment`,  
`InboundReceipt` / lines, `DockAppointment`,  
`OutboundOrder` / lines / `Allocation`, `Wave`, `PickTask`, `Carton`, `Shipment`,  
`Contract` / `SlaDefinition`,  
`RateCard`, `Charge`, `Invoice` / `InvoiceLine`

**Ship-to / bill-to:** JSON on `OutboundOrder` (no Customer master).

---

## 9. Core operational flows

1. **Inbound:** ASN → check-in → receive lines → putaway (suggest/confirm) → stock available  
2. **Outbound:** Order (+ ship-to) → allocate (FEFO/FIFO) → wave → pick → pack/cartons → ship  
3. **Inventory:** Holds, adjustments (approve/reject), ledger txns  
4. **Billing:** Rate card → meter (storage/pick/pack/ship) → draft charges → invoice → issue → portal visibility  

---

## 10. Security & multi-tenancy

- JWT bearer on API; NextAuth session on UIs  
- Portal never sees other clients’ data (`clientId` + RLS)  
- Ops uses `warehouse_ops` actor role to cross tenants  
- Feature license blocks unlicensed commercial APIs  
- Throttling enabled on API  

---

## 11. Known gaps (not full product yet)

| Priority | Gap |
|----------|-----|
| High | OMS/API order ingest, carrier labels/tracking |
| High | RMA / returns (stub only) |
| Medium | RF/mobile scan apps |
| Medium | Full warehouse configurator (location UI, slotting, replenishment) |
| Medium | Transfers, proper cycle count, serial enforcement |
| Lower | EDI, durable notifications, GST/e-invoice automation |

---

## 12. Dev credentials (seed)

| App | Email | Password |
|-----|--------|----------|
| Ops | `admin@wms.local` | `admin123` |
| Portal | `portala@demo.com` | `portal123` |

DB (typical): `postgresql://wms:wms123@localhost:5433/wms_dev`

---

## 13. Useful commands

```bash
# Infra
docker compose -f infrastructure/docker/docker-compose.dev.yml up -d

# DB
npm run db:generate && npm run db:migrate && npm run db:seed

# Apps (from repo root)
npm run dev
# or run api / ops-web / portal-web workspaces individually
```
