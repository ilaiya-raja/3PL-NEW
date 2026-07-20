import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@wms/db';
import { ErrorCodes } from '@wms/types';
import { uuidSchema } from '@wms/zod-schemas';
import { WmsException } from '../common/exceptions/wms.exception';
import { PrismaService } from './prisma.service';

@Injectable()
export class TenantPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  withTenant<T>(
    clientId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    this.assertValidUuid(clientId);

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT set_config('app.client_id', ${clientId}, true)`,
      );
      return fn(tx);
    });
  }

  withOpsRole<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT set_config('app.actor_role', 'warehouse_ops', true)`,
      );
      return fn(tx);
    });
  }

  private assertValidUuid(clientId: string): void {
    const parsed = uuidSchema.safeParse(clientId);
    if (!parsed.success) {
      throw new WmsException(
        ErrorCodes.VAL_VALIDATION_FAILED,
        'Invalid client ID format',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
