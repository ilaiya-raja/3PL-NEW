# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS deps
COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/types/package.json ./packages/types/
COPY packages/zod-schemas/package.json ./packages/zod-schemas/
RUN npm install --include=dev

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.base.json turbo.json ./
COPY apps/api ./apps/api
COPY packages ./packages
RUN npm run generate -w @wms/db
RUN npm run build -w @wms/types
RUN npm run build -w @wms/zod-schemas
RUN npm run build -w @wms/db
RUN npm run build -w @wms/api
RUN npm prune --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

RUN apk add --no-cache wget \
  && addgroup --system --gid 1001 wms \
  && adduser --system --uid 1001 --ingroup wms wms

COPY --from=builder --chown=wms:wms /app/node_modules ./node_modules
COPY --from=builder --chown=wms:wms /app/package.json ./package.json
COPY --from=builder --chown=wms:wms /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=wms:wms /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=wms:wms /app/packages ./packages

USER wms
WORKDIR /app/apps/api
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1

CMD ["node", "dist/main.js"]
