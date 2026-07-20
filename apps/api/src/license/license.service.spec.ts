import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync, randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { LicenseEdition } from '@wms/types';
import { LicenseService } from './license.service';
import type { PrismaService } from '../database/prisma.service';
import type { TenantPrismaService } from '../database/tenant-prisma.service';

describe('LicenseService', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  function signLicense(overrides: Record<string, unknown> = {}): string {
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const payload = {
      licenseId: randomUUID(),
      customerName: 'Test Customer',
      edition: LicenseEdition.STARTER,
      issuedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      gracePeriodDays: 14,
      limits: {
        maxClients: 3,
        maxOpsUsers: 5,
        maxPortalUsers: 10,
        maxWarehouses: 1,
      },
      features: ['core'],
      ...overrides,
    };

    return jwt.sign(payload, privateKey, { algorithm: 'RS256', noTimestamp: true });
  }

  function createService(licenseKey: string | null, counts: Record<string, number> = {}) {
    const config = {
      get: (key: string) => {
        if (key === 'LICENSE_KEY') return licenseKey ?? undefined;
        if (key === 'LICENSE_PUBLIC_KEY') return publicKey;
        return undefined;
      },
    } as unknown as ConfigService;

    const prisma = {
      license: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      opsUser: {
        count: jest.fn().mockResolvedValue(counts.opsUsers ?? 0),
      },
      warehouse: {
        count: jest.fn().mockResolvedValue(counts.warehouses ?? 0),
      },
    } as unknown as PrismaService;

    const tenantPrisma = {
      withOpsRole: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          client: { count: jest.fn().mockResolvedValue(counts.clients ?? 0) },
          portalUser: { count: jest.fn().mockResolvedValue(counts.portalUsers ?? 0) },
          license: {
            updateMany: jest.fn(),
            create: jest.fn(),
          },
        }),
      ),
    } as unknown as TenantPrismaService;

    return new LicenseService(config, prisma, tenantPrisma);
  }

  it('checkLimit allows when under max', async () => {
    const svc = createService(signLicense(), { clients: 2 });
    await svc.onModuleInit();
    const result = await svc.checkLimit('clients');
    expect(result).toEqual({ allowed: true, current: 2, max: 3 });
  });

  it('checkLimit blocks when at max', async () => {
    const svc = createService(signLicense(), { clients: 3 });
    await svc.onModuleInit();
    const result = await svc.checkLimit('clients');
    expect(result.allowed).toBe(false);
  });

  it('checkLimit allows unlimited (-1)', async () => {
    const svc = createService(
      signLicense({
        edition: LicenseEdition.ENTERPRISE,
        limits: {
          maxClients: -1,
          maxOpsUsers: -1,
          maxPortalUsers: -1,
          maxWarehouses: -1,
        },
        features: ['core', 'billing'],
      }),
      { clients: 999 },
    );
    await svc.onModuleInit();
    const result = await svc.checkLimit('clients');
    expect(result.allowed).toBe(true);
    expect(result.max).toBe(-1);
  });

  it('blocks writes after grace period', async () => {
    const expired = new Date();
    expired.setDate(expired.getDate() - 30);
    const svc = createService(
      signLicense({
        expiresAt: expired.toISOString(),
        gracePeriodDays: 14,
      }),
    );
    await svc.onModuleInit();
    expect(svc.isWriteBlocked()).toBe(true);
    expect(svc.getExpiryBanner()).toBe('expired');
  });

  it('allows writes during grace period', async () => {
    const expired = new Date();
    expired.setDate(expired.getDate() - 5);
    const svc = createService(
      signLicense({
        expiresAt: expired.toISOString(),
        gracePeriodDays: 14,
      }),
    );
    await svc.onModuleInit();
    expect(svc.isWriteBlocked()).toBe(false);
    expect(svc.getExpiryBanner()).toBe('grace');
  });

  it('warns when under 30 days', async () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 15);
    const svc = createService(signLicense({ expiresAt: soon.toISOString() }));
    await svc.onModuleInit();
    expect(svc.getExpiryBanner()).toBe('warning');
    expect(svc.isWriteBlocked()).toBe(false);
  });

  it('assertWithinLimit throws LIMIT_REACHED', async () => {
    const svc = createService(signLicense(), { clients: 3 });
    await svc.onModuleInit();
    await expect(svc.assertWithinLimit('clients')).rejects.toMatchObject({
      errorCode: 'WMS_LIC_LIMIT_REACHED',
      getStatus: expect.any(Function),
    });
    try {
      await svc.assertWithinLimit('clients');
    } catch (e: unknown) {
      const err = e as { getStatus: () => number };
      expect(err.getStatus()).toBe(HttpStatus.FORBIDDEN);
    }
  });

  it('isFeatureEnabled respects features list', async () => {
    const svc = createService(signLicense({ features: ['core'] }));
    await svc.onModuleInit();
    expect(svc.isFeatureEnabled('core')).toBe(true);
    expect(svc.isFeatureEnabled('billing')).toBe(false);
  });
});
