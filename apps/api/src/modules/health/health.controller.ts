import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { LicenseStatus } from '@wms/types';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../../database/prisma.service';
import { Public } from '../../common/decorators/public.decorator';
import { SkipLicense } from '../../common/decorators/skip-license.decorator';
import { LicenseService } from '../../license/license.service';

interface HealthResponse {
  status: 'ok' | 'error';
  version: string;
  database: {
    connected: boolean;
  };
  license: LicenseStatus;
  timestamp: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly version: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly licenseService: LicenseService,
  ) {
    this.version = this.readAppVersion();
  }

  @Public()
  @SkipLicense()
  @Get()
  @ApiOperation({ summary: 'Health check' })
  async check(): Promise<HealthResponse> {
    let connected = false;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      connected = true;
    } catch {
      connected = false;
    }

    return {
      status: connected ? 'ok' : 'error',
      version: this.version,
      database: { connected },
      license: await this.licenseService.getStatus(),
      timestamp: new Date().toISOString(),
    };
  }

  private readAppVersion(): string {
    try {
      const packageJsonPath = join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
        version?: string;
      };
      return packageJson.version ?? '1.0.0';
    } catch {
      return '1.0.0';
    }
  }
}
