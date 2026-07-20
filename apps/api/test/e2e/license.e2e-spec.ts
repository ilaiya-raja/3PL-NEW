/**
 * License e2e tests.
 * Requires running API dependencies (Postgres) and seeded admin user.
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { generateKeyPairSync, randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';
import { LicenseService } from '../../src/license/license.service';
import { LicenseEdition } from '@wms/types';

describe('License (e2e)', () => {
  let app: NestFastifyApplication;
  let opsToken: string;
  let licenseService: LicenseService;

  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  function sign(overrides: Record<string, unknown> = {}): string {
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    return jwt.sign(
      {
        licenseId: randomUUID(),
        customerName: 'E2E Customer',
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
      },
      privateKey,
      { algorithm: 'RS256', noTimestamp: true },
    );
  }

  beforeAll(async () => {
    process.env.LICENSE_PUBLIC_KEY = publicKey;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    licenseService = app.get(LicenseService);

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'admin@wms.local', password: 'admin123' },
    });
    const body = JSON.parse(login.body) as { data: { accessToken: string } };
    opsToken = body.data.accessToken;
  }, 60000);

  afterAll(async () => {
    await app?.close();
  });

  it('expired-past-grace key → writes 402, reads 200', async () => {
    const expired = new Date();
    expired.setDate(expired.getDate() - 40);
    const key = sign({ expiresAt: expired.toISOString(), gracePeriodDays: 14 });

    // Hot-activate expired key
    const activate = await app.inject({
      method: 'POST',
      url: '/api/v1/license/activate',
      headers: { authorization: `Bearer ${opsToken}` },
      payload: { licenseKey: key },
    });
    // Activation itself is allowed (skip license) even if key is expired
    expect([200, 201]).toContain(activate.statusCode);
    await licenseService.reload();

    const write = await app.inject({
      method: 'POST',
      url: '/api/v1/clients',
      headers: { authorization: `Bearer ${opsToken}` },
      payload: {
        code: `X${Date.now().toString(36).toUpperCase().slice(0, 6)}`,
        legalName: 'Should Fail Corp',
      },
    });
    expect(write.statusCode).toBe(402);

    const read = await app.inject({
      method: 'GET',
      url: '/api/v1/clients?limit=5',
      headers: { authorization: `Bearer ${opsToken}` },
    });
    expect(read.statusCode).toBe(200);
  });

  it('STARTER key → 4th client creation returns 403 LIMIT_REACHED', async () => {
    const key = sign({
      edition: LicenseEdition.STARTER,
      limits: {
        maxClients: 3,
        maxOpsUsers: 5,
        maxPortalUsers: 10,
        maxWarehouses: 1,
      },
    });

    await app.inject({
      method: 'POST',
      url: '/api/v1/license/activate',
      headers: { authorization: `Bearer ${opsToken}` },
      payload: { licenseKey: key },
    });
    await licenseService.reload();

    // Seed already has DEMO-A and DEMO-B (2). Create one more (3rd) then 4th should fail.
    const status = await app.inject({
      method: 'GET',
      url: '/api/v1/license/status',
      headers: { authorization: `Bearer ${opsToken}` },
    });
    const statusBody = JSON.parse(status.body) as {
      data: { limits: { clients: { current: number; max: number } } };
    };
    const current = statusBody.data.limits.clients.current;

    // Fill up to max
    for (let i = current; i < 3; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/clients',
        headers: { authorization: `Bearer ${opsToken}` },
        payload: {
          code: `S${Date.now().toString(36).toUpperCase()}${i}`,
          legalName: `Starter Client ${i}`,
        },
      });
      expect(res.statusCode).toBeLessThan(300);
    }

    const fourth = await app.inject({
      method: 'POST',
      url: '/api/v1/clients',
      headers: { authorization: `Bearer ${opsToken}` },
      payload: {
        code: `OVER${Date.now().toString(36).toUpperCase().slice(0, 4)}`,
        legalName: 'Over Limit Client',
      },
    });
    expect(fourth.statusCode).toBe(403);
    const body = JSON.parse(fourth.body) as { errorCode: string };
    expect(body.errorCode).toBe('WMS_LIC_LIMIT_REACHED');
  });
});
