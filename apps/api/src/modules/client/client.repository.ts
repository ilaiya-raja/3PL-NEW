import { Injectable, HttpStatus } from '@nestjs/common';
import type { Prisma } from '@wms/db';
import { ErrorCodes } from '@wms/types';
import { TenantPrismaService } from '../../database/tenant-prisma.service';
import { WmsException } from '../../common/exceptions/wms.exception';
import type { CreateClientDto } from './dto/create-client.dto';
import type { UpdateClientDto } from './dto/update-client.dto';
import type { UpdateClientStatusDto } from './dto/update-status.dto';
import type { UpdateClientConfigDto } from './dto/update-config.dto';
import type { ListClientsQueryDto } from './dto/list-clients-query.dto';

@Injectable()
export class ClientRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async create(data: CreateClientDto) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const exists = await tx.client.findFirst({
        where: { code: data.code.toUpperCase() },
      });

      if (exists) {
        throw new WmsException(
          ErrorCodes.VAL_VALIDATION_FAILED,
          `Client with code ${data.code} already exists`,
          HttpStatus.CONFLICT,
        );
      }

      return tx.client.create({
        data: {
          code: data.code.toUpperCase(),
          legalName: data.legalName,
          gstin: data.gstin,
          status: data.status ?? 'ONBOARDING',
          config: (data.config ?? {}) as unknown as Prisma.JsonObject,
          branding: (data.branding ?? {}) as unknown as Prisma.JsonObject,
        },
      });
    });
  }

  async findMany(query: ListClientsQueryDto) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const where: Prisma.ClientWhereInput = {};

      if (query.status) {
        where.status = query.status;
      }

      if (query.search) {
        where.OR = [
          { code: { contains: query.search, mode: 'insensitive' } },
          { legalName: { contains: query.search, mode: 'insensitive' } },
        ];
      }

      const [items, total] = await Promise.all([
        tx.client.findMany({
          where,
          skip: (query.page! - 1) * query.limit!,
          take: query.limit,
          orderBy: query.sortBy
            ? { [query.sortBy]: query.sortOrder }
            : { createdAt: 'desc' },
        }),
        tx.client.count({ where }),
      ]);

      return { items, total };
    });
  }

  async findById(id: string) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const client = await tx.client.findUnique({
        where: { id },
      });

      if (!client) {
        throw new WmsException(
          ErrorCodes.CLIENT_NOT_FOUND,
          `Client with ID ${id} not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      return client;
    });
  }

  async update(id: string, data: UpdateClientDto) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      await this.findById(id);

      const updateData: Prisma.ClientUpdateInput = {};

      if (data.legalName !== undefined) {
        updateData.legalName = data.legalName;
      }
      if (data.gstin !== undefined) {
        updateData.gstin = data.gstin;
      }
      if (data.branding !== undefined) {
        updateData.branding = data.branding as unknown as Prisma.JsonObject;
      }

      return tx.client.update({
        where: { id },
        data: updateData,
      });
    });
  }

  async updateStatus(id: string, data: UpdateClientStatusDto) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      await this.findById(id);

      return tx.client.update({
        where: { id },
        data: { status: data.status },
      });
    });
  }

  async updateConfig(id: string, data: UpdateClientConfigDto) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const client = await this.findById(id);
      const currentConfig = (client.config ?? {}) as Record<string, unknown>;

      return tx.client.update({
        where: { id },
        data: {
          config: {
            ...currentConfig,
            ...data,
          } as unknown as Prisma.JsonObject,
        },
      });
    });
  }
}
