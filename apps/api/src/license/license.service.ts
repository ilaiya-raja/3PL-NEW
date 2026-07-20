import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpStatus } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import {
  ErrorCodes,
  LicenseEdition,
  type LicenseLimitCheck,
  type LicensePayload,
  type LicenseStatus,
  type LimitKind,
} from '@wms/types';
import { PrismaService } from '../database/prisma.service';
import { TenantPrismaService } from '../database/tenant-prisma.service';
import { WmsException } from '../common/exceptions/wms.exception';
import { EMBEDDED_LICENSE_PUBLIC_KEY } from './license.constants';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class LicenseService implements OnModuleInit {
  private readonly logger = new Logger(LicenseService.name);
  private cached: LicensePayload | null = null;
  private cachedRawKey: string | null = null;
  private loadError: string | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    try {
      const envKey = this.config.get<string>('LICENSE_KEY')?.trim();
      let rawKey = envKey && envKey.length > 0 ? envKey : null;

      if (!rawKey) {
        const row = await this.prisma.license.findFirst({
          where: { active: true },
          orderBy: { activatedAt: 'desc' },
        });
        rawKey = row?.licenseKey ?? null;
      }

      if (!rawKey) {
        this.cached = null;
        this.cachedRawKey = null;
        this.loadError = 'No license key configured';
        this.logger.warn(this.loadError);
        return;
      }

      this.cached = this.verifyAndDecode(rawKey);
      this.cachedRawKey = rawKey;
      this.loadError = null;
      this.logger.log(
        `License loaded: ${this.cached.edition} for ${this.cached.customerName}`,
      );
    } catch (err: unknown) {
      this.cached = null;
      this.cachedRawKey = null;
      this.loadError = err instanceof Error ? err.message : 'License load failed';
      this.logger.error(this.loadError);
    }
  }

  getLicense(): LicensePayload {
    if (!this.cached) {
      throw new WmsException(
        ErrorCodes.LIC_INVALID,
        this.loadError ?? 'No valid license',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    return this.cached;
  }

  isFeatureEnabled(feature: string): boolean {
    if (!this.cached) return false;
    return this.cached.features.includes(feature);
  }

  async checkLimit(kind: LimitKind): Promise<LicenseLimitCheck> {
    const license = this.getLicense();
    const maxMap: Record<LimitKind, number> = {
      clients: license.limits.maxClients,
      opsUsers: license.limits.maxOpsUsers,
      portalUsers: license.limits.maxPortalUsers,
      warehouses: license.limits.maxWarehouses,
    };
    const max = maxMap[kind];
    const current = await this.countUsage(kind);
    return {
      allowed: max === -1 || current < max,
      current,
      max,
    };
  }

  async assertWithinLimit(kind: LimitKind): Promise<void> {
    const check = await this.checkLimit(kind);
    if (!check.allowed) {
      const license = this.getLicense();
      throw new WmsException(
        ErrorCodes.LIC_LIMIT_REACHED,
        `License limit reached for ${kind}`,
        HttpStatus.FORBIDDEN,
        {
          current: check.current,
          max: check.max,
          edition: license.edition,
        },
      );
    }
  }

  async getStatus(): Promise<LicenseStatus> {
    if (!this.cached) {
      return {
        valid: false,
        edition: null,
        customerName: null,
        expiresAt: null,
        daysRemaining: null,
        inGracePeriod: false,
        features: [],
        limits: {
          clients: { current: await this.countUsage('clients'), max: 0 },
          opsUsers: { current: await this.countUsage('opsUsers'), max: 0 },
          portalUsers: { current: await this.countUsage('portalUsers'), max: 0 },
          warehouses: { current: await this.countUsage('warehouses'), max: 0 },
        },
        maskedKey: null,
      };
    }

    const expiry = this.evaluateExpiry(this.cached);
    const [clients, opsUsers, portalUsers, warehouses] = await Promise.all([
      this.countUsage('clients'),
      this.countUsage('opsUsers'),
      this.countUsage('portalUsers'),
      this.countUsage('warehouses'),
    ]);

    return {
      valid: expiry.state === 'valid' || expiry.state === 'warning' || expiry.state === 'grace',
      edition: this.cached.edition,
      customerName: this.cached.customerName,
      expiresAt: this.cached.expiresAt,
      daysRemaining: expiry.daysRemaining,
      inGracePeriod: expiry.state === 'grace',
      features: this.cached.features,
      limits: {
        clients: { current: clients, max: this.cached.limits.maxClients },
        opsUsers: { current: opsUsers, max: this.cached.limits.maxOpsUsers },
        portalUsers: { current: portalUsers, max: this.cached.limits.maxPortalUsers },
        warehouses: { current: warehouses, max: this.cached.limits.maxWarehouses },
      },
      maskedKey: this.maskKey(this.cachedRawKey),
    };
  }

  /**
   * Returns whether write operations are allowed.
   * Reads always work; writes blocked when invalid or past grace.
   */
  canWrite(): boolean {
    if (!this.cached) return false;
    const expiry = this.evaluateExpiry(this.cached);
    return expiry.state !== 'expired' && expiry.state !== 'invalid';
  }

  isWriteBlocked(): boolean {
    return !this.canWrite();
  }

  getExpiryBanner(): 'none' | 'warning' | 'grace' | 'expired' {
    if (!this.cached) return 'expired';
    const expiry = this.evaluateExpiry(this.cached);
    if (expiry.state === 'warning') return 'warning';
    if (expiry.state === 'grace') return 'grace';
    if (expiry.state === 'expired') return 'expired';
    return 'none';
  }

  async activate(licenseKey: string, activatedBy: string): Promise<LicenseStatus> {
    const payload = this.verifyAndDecode(licenseKey);

    await this.tenantPrisma.withOpsRole(async (tx) => {
      await tx.license.updateMany({
        where: { active: true },
        data: { active: false },
      });
      await tx.license.create({
        data: {
          licenseKey,
          activatedBy: UUID_RE.test(activatedBy) ? activatedBy : null,
          active: true,
        },
      });
    });

    this.cached = payload;
    this.cachedRawKey = licenseKey;
    this.loadError = null;
    this.logger.log(`License activated: ${payload.edition} / ${payload.customerName}`);
    return this.getStatus();
  }

  private verifyAndDecode(licenseKey: string): LicensePayload {
    const publicKey = this.resolvePublicKey();
    let decoded: jwt.JwtPayload | string;
    try {
      decoded = jwt.verify(licenseKey, publicKey, {
        algorithms: ['RS256'],
      });
    } catch {
      throw new WmsException(
        ErrorCodes.LIC_INVALID,
        'License key signature is invalid or malformed',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    if (typeof decoded === 'string' || !decoded) {
      throw new WmsException(
        ErrorCodes.LIC_INVALID,
        'License payload is invalid',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const payload = decoded as unknown as LicensePayload;
    this.assertPayloadShape(payload);
    return payload;
  }

  private assertPayloadShape(payload: LicensePayload): void {
    const editions = Object.values(LicenseEdition);
    if (
      !payload.licenseId ||
      !payload.customerName ||
      !editions.includes(payload.edition) ||
      !payload.expiresAt ||
      !payload.limits ||
      !Array.isArray(payload.features)
    ) {
      throw new WmsException(
        ErrorCodes.LIC_INVALID,
        'License payload missing required fields',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }

  private resolvePublicKey(): string {
    const fromEnv = this.config.get<string>('LICENSE_PUBLIC_KEY');
    if (fromEnv && fromEnv.trim().length > 0) {
      return fromEnv.replace(/\\n/g, '\n');
    }
    return EMBEDDED_LICENSE_PUBLIC_KEY;
  }

  private evaluateExpiry(payload: LicensePayload): {
    state: 'valid' | 'warning' | 'grace' | 'expired' | 'invalid';
    daysRemaining: number;
  } {
    const expiresAt = new Date(payload.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      return { state: 'invalid', daysRemaining: 0 };
    }

    const now = Date.now();
    const msRemaining = expiresAt.getTime() - now;
    const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
    const graceDays = payload.gracePeriodDays ?? 14;
    const graceEnd = expiresAt.getTime() + graceDays * 24 * 60 * 60 * 1000;

    if (now > graceEnd) {
      return { state: 'expired', daysRemaining };
    }
    if (now > expiresAt.getTime()) {
      return { state: 'grace', daysRemaining };
    }
    if (daysRemaining <= 30) {
      return { state: 'warning', daysRemaining };
    }
    return { state: 'valid', daysRemaining };
  }

  private async countUsage(kind: LimitKind): Promise<number> {
    // Shared tables (ops_user, warehouse) have no RLS; tenant tables need ops role.
    switch (kind) {
      case 'opsUsers':
        return this.prisma.opsUser.count({ where: { active: true } });
      case 'warehouses':
        return this.prisma.warehouse.count({ where: { active: true } });
      case 'clients':
        return this.tenantPrisma.withOpsRole((tx) => tx.client.count());
      case 'portalUsers':
        return this.tenantPrisma.withOpsRole((tx) =>
          tx.portalUser.count({ where: { active: true } }),
        );
      default: {
        const _exhaustive: never = kind;
        return _exhaustive;
      }
    }
  }

  private maskKey(key: string | null): string | null {
    if (!key || key.length < 10) return null;
    const last6 = key.slice(-6);
    return `XXXX-...-${last6}`;
  }
}
