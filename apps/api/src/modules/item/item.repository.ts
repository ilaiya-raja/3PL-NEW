import { Injectable, HttpStatus } from '@nestjs/common';
import type { Prisma } from '@wms/db';
import { ErrorCodes } from '@wms/types';
import { TenantPrismaService } from '../../database/tenant-prisma.service';
import { WmsException } from '../../common/exceptions/wms.exception';
import type { CreateItemDto } from './dto/create-item.dto';
import type { UpdateItemDto } from './dto/update-item.dto';
import type { ListItemsQueryDto } from './dto/list-items-query.dto';

@Injectable()
export class ItemRepository {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async create(clientId: string, data: CreateItemDto) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const exists = await tx.item.findFirst({
        where: {
          clientId,
          sku: data.sku.toUpperCase(),
        },
      });

      if (exists) {
        throw new WmsException(
          ErrorCodes.VAL_VALIDATION_FAILED,
          `Item with SKU ${data.sku} already exists for this client`,
          HttpStatus.CONFLICT,
        );
      }

      return tx.item.create({
        data: {
          clientId,
          sku: data.sku.toUpperCase(),
          description: data.description,
          uom: data.uom ?? 'EA',
          packConfig: (data.packConfig ?? {}) as unknown as Prisma.JsonObject,
          lotTracked: data.lotTracked ?? false,
          serialTracked: data.serialTracked ?? false,
          shelfLifeDays: data.shelfLifeDays ?? null,
          minShipShelfPct: data.minShipShelfPct ?? null,
          hazmatClass: data.hazmatClass ?? null,
          tempClass: data.tempClass ?? 'AMBIENT',
          velocityClass: data.velocityClass ?? null,
          active: data.active ?? true,
        },
      });
    });
  }

  async findMany(clientId: string, query: ListItemsQueryDto) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const where: Prisma.ItemWhereInput = { clientId };

      if (query.active !== undefined) {
        where.active = query.active;
      }

      if (query.lotTracked !== undefined) {
        where.lotTracked = query.lotTracked;
      }

      if (query.search) {
        where.OR = [
          { sku: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
        ];
      }

      const [items, total] = await Promise.all([
        tx.item.findMany({
          where,
          skip: (query.page! - 1) * query.limit!,
          take: query.limit,
          orderBy: query.sortBy
            ? { [query.sortBy]: query.sortOrder }
            : { createdAt: 'desc' },
        }),
        tx.item.count({ where }),
      ]);

      return { items, total };
    });
  }

  async findById(id: string) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const item = await tx.item.findUnique({
        where: { id },
      });

      if (!item) {
        throw new WmsException(
          ErrorCodes.ITEM_NOT_FOUND,
          `Item with ID ${id} not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      return item;
    });
  }

  async update(id: string, data: UpdateItemDto) {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      await this.findById(id);

      const updateData: Prisma.ItemUpdateInput = {};

      if (data.sku !== undefined) {
        updateData.sku = data.sku.toUpperCase();
      }
      if (data.description !== undefined) {
        updateData.description = data.description;
      }
      if (data.uom !== undefined) {
        updateData.uom = data.uom;
      }
      if (data.packConfig !== undefined) {
        updateData.packConfig = data.packConfig as unknown as Prisma.JsonObject;
      }
      if (data.lotTracked !== undefined) {
        updateData.lotTracked = data.lotTracked;
      }
      if (data.serialTracked !== undefined) {
        updateData.serialTracked = data.serialTracked;
      }
      if (data.shelfLifeDays !== undefined) {
        updateData.shelfLifeDays = data.shelfLifeDays;
      }
      if (data.minShipShelfPct !== undefined) {
        updateData.minShipShelfPct = data.minShipShelfPct;
      }
      if (data.hazmatClass !== undefined) {
        updateData.hazmatClass = data.hazmatClass;
      }
      if (data.tempClass !== undefined) {
        updateData.tempClass = data.tempClass;
      }
      if (data.velocityClass !== undefined) {
        updateData.velocityClass = data.velocityClass;
      }
      if (data.active !== undefined) {
        updateData.active = data.active;
      }

      return tx.item.update({
        where: { id },
        data: updateData,
      });
    });
  }

  async importBatch(
    clientId: string,
    rows: CreateItemDto[],
  ): Promise<{ created: number; errors: Array<{ row: number; message: string }> }> {
    return this.tenantPrisma.withOpsRole(async (tx) => {
      const errors: Array<{ row: number; message: string }> = [];
      let created = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const exists = await tx.item.findFirst({
            where: {
              clientId,
              sku: row.sku.toUpperCase(),
            },
          });

          if (exists) {
            errors.push({
              row: i + 1,
              message: `Item with SKU ${row.sku} already exists`,
            });
            continue;
          }

          await tx.item.create({
            data: {
              clientId,
              sku: row.sku.toUpperCase(),
              description: row.description,
              uom: row.uom ?? 'EA',
              packConfig: (row.packConfig ?? {}) as unknown as Prisma.JsonObject,
              lotTracked: row.lotTracked ?? false,
              serialTracked: row.serialTracked ?? false,
              shelfLifeDays: row.shelfLifeDays ?? null,
              minShipShelfPct: row.minShipShelfPct ?? null,
              hazmatClass: row.hazmatClass ?? null,
              tempClass: row.tempClass ?? 'AMBIENT',
              velocityClass: row.velocityClass ?? null,
              active: row.active ?? true,
            },
          });

          created++;
        } catch (error) {
          errors.push({
            row: i + 1,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return { created, errors };
    });
  }
}
