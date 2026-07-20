# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS deps
COPY package.json ./
COPY apps/ops-web/package.json ./apps/ops-web/
COPY packages/types/package.json ./packages/types/
COPY packages/zod-schemas/package.json ./packages/zod-schemas/
RUN npm install --include=dev

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.base.json turbo.json ./
COPY apps/ops-web ./apps/ops-web
COPY packages/types ./packages/types
COPY packages/zod-schemas ./packages/zod-schemas
RUN mkdir -p apps/ops-web/public
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @wms/types
RUN npm run build -w @wms/zod-schemas
RUN npm run build -w @wms/ops-web

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache wget \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder /app/apps/ops-web/public ./apps/ops-web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/ops-web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/ops-web/.next/static ./apps/ops-web/.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3000/ || exit 1

CMD ["node", "apps/ops-web/server.js"]
