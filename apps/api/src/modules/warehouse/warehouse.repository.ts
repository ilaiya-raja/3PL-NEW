import { Injectable, HttpStatus } from '@nestjs/common';
import type { Prisma } from '@wms/db';
import { ErrorCodes } from '@wms/types';
import { PrismaService } from '../../database/prisma.service';
import { WmsException } from '../../common/exceptions/wms.exception';
import type { CreateWarehouseDto } from './dto/create-warehouse.dto';
import type { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import type { ListWarehousesQueryDto } from './dto/list-warehouses-query.dto';

@Injectable()
export class WarehouseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateWarehouseDto) {
    const exists = await this.prisma.warehouse.findFirst({
      where: { code: data.code.toUpperCase() },
    });

    if (exists) {
      throw new WmsException(
        ErrorCodes.VAL_VALIDATION_FAILED,
        `Warehouse with code ${data.code} already exists`,
        HttpStatus.CONFLICT,
      );
    }

    return this.prisma.warehouse.create({
      data: {
        code: data.code.toUpperCase(),
        name: data.name,
        address: data.address as unknown as Prisma.JsonObject,
        active: data.active ?? true,
      },
    });
  }

  async findMany(query: ListWarehousesQueryDto) {
    const where: Prisma.WarehouseWhereInput = {};

    if (query.active !== undefined) {
      where.active = query.active;
    }

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.warehouse.findMany({
        where,
        skip: (query.page! - 1) * query.limit!,
        take: query.limit,
        orderBy: query.sortBy
          ? { [query.sortBy]: query.sortOrder }
          : { createdAt: 'desc' },
      }),
      this.prisma.warehouse.count({ where }),
    ]);

    return { items, total };
  }

  async findById(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
    });

    if (!warehouse) {
      throw new WmsException(
        ErrorCodes.WH_NOT_FOUND,
        `Warehouse with ID ${id} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    return warehouse;
  }

  async update(id: string, data: UpdateWarehouseDto) {
    await this.findById(id);

    const updateData: Prisma.WarehouseUpdateInput = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.address !== undefined) {
      updateData.address = data.address as unknown as Prisma.JsonObject;
    }
    if (data.active !== undefined) {
      updateData.active = data.active;
    }

    return this.prisma.warehouse.update({
      where: { id },
      data: updateData,
    });
  }
}
