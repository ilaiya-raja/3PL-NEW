# Digisailor 3PL Warehouse Management System

Production-grade, multi-tenant 3PL WMS for on-premise (Docker) and cloud deployments.

## Stack

| Layer | Technology |
|-------|------------|
| Monorepo | Turborepo (npm workspaces) |
| API | NestJS 10 + Fastify |
| Frontends | Next.js 14 (ops-web, portal-web) |
| DB | PostgreSQL 16 + Prisma 5 + RLS |
| Cache | Valkey 7 |
| Storage | MinIO (on-prem) / S3 / GCS |
| Auth | NextAuth + Passport JWT (OPS + PORTAL realms) |

## Quickstart (development)

### Prerequisites

- Node.js 20+
- Docker + Docker Compose
- npm 10+

### 1. Start infrastructure

```bash
docker compose -f infrastructure/docker/docker-compose.dev.yml up -d
```

### 2. Configure environment

```bash
cp .env.example .env
npm run license:generate   # prints LICENSE_KEY + LICENSE_PUBLIC_KEY — paste into .env
```

### 3. Install, migrate, seed

```bash
npm install
npm run db:generate
cd packages/db && npx prisma migrate deploy && npm run seed && cd ../..
npm run build -w @wms/types -w @wms/zod-schemas -w @wms/db
```

### 4. Run apps

```bash
npm run dev
```

| App | URL |
|-----|-----|
| API | http://localhost:4000/api/v1 |
| Swagger | http://localhost:4000/api/docs |
| Ops Web | http://localhost:3000 |
| Portal Web | http://localhost:3001 |

### Default credentials

| Realm | Email | Password |
|-------|-------|----------|
| Ops Admin | admin@wms.local | admin123 |
| Ops Supervisor | supervisor@wms.local | admin123 |
| Portal A | portala@demo.com | portal123 |
| Portal B | portalb@demo.com | portal123 |

## License activation

1. Obtain a signed license key from Digisailor (or generate a **dev-only** key with `npm run license:generate`).
2. Set `LICENSE_PUBLIC_KEY` and optionally `LICENSE_KEY` in `.env`.
3. Or activate at runtime (ADMIN): `POST /api/v1/license/activate` with `{ "licenseKey": "..." }`.
4. Check status: `GET /api/v1/license/status`.

Writes return `402 LICENSE_EXPIRED` after hard expiry + grace period. Reads continue to work.

## On-premise install (Ubuntu 22.04)

```bash
# 1. Install Docker
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
sudo usermod -aG docker $USER   # re-login after

# 2. Clone and configure
git clone <repo-url> 3pl-wms && cd 3pl-wms
cp .env.example .env
# Edit .env: set JWT secrets, LICENSE_KEY, LICENSE_PUBLIC_KEY, strong DB password

# 3. Launch full stack
docker compose -f infrastructure/docker/docker-compose.yml up -d --build

# 4. Hosts (or use your DNS)
echo '127.0.0.1 ops.wms.local portal.wms.local api.wms.local' | sudo tee -a /etc/hosts
```

Open https://ops.wms.local after TLS certs are placed in the nginx certs volume.

### Update procedure

```bash
git pull
docker compose -f infrastructure/docker/docker-compose.yml up -d --build
# Migrations run on api container start (or): docker compose exec api npx prisma migrate deploy
```

### Backup

```bash
# Example daily cron
0 2 * * * docker compose -f /opt/3pl-wms/infrastructure/docker/docker-compose.yml exec -T postgres \
  pg_dump -U wms wms_dev | gzip > /backups/wms-$(date +\%F).sql.gz
```

## Monorepo layout

```
apps/api          NestJS business logic
apps/ops-web      Operator UI
apps/portal-web   Client portal
packages/db       Prisma schema, migrations, seed
packages/types    Shared enums & interfaces
packages/zod-schemas  Shared Zod validation
infrastructure/   Docker, nginx
```

## Multi-tenancy

Isolation is enforced at four layers: JWT `clientId` claim → TenantGuard → TenantPrismaService (`SET LOCAL app.client_id`) → PostgreSQL RLS.

## License

Copyright © Digisailor. All rights reserved.
