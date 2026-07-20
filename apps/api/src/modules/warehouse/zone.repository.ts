import { Injectable, HttpStatus } from '@nestjs/common';
import type { Prisma } from '@wms/db';
import { ErrorCodes } from '@wms/types';
import { PrismaService } from '../../database/prisma.service';
import { WmsException } from '../../common/exceptions/wms.exception';
import type { CreateZoneDto } from './dto/create-zone.dto';
import type { UpdateZoneDto } from './dto/update-zone.dto';

@Injectable()
export class ZoneRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(warehouseId: string, data: CreateZoneDto) {
    const exists = await this.prisma.zone.findFirst({
      where: {
        warehouseId,
        code: data.code.toUpperCase(),
      },
    });

    if (exists) {
      throw new WmsException(
        ErrorCodes.VAL_VALIDATION_FAILED,
        `Zone with code ${data.code} already exists in this warehouse`,
        HttpStatus.CONFLICT,
      );
    }

    return this.prisma.zone.create({
      data: {
        warehouseId,
        code: data.code.toUpperCase(),
        name: data.name,
        type: data.type,
        tempClass: data.tempClass ?? 'AMBIENT',
        hazmatAllowed: data.hazmatAllowed ?? false,
      },
    });
  }

  async findByWarehouseId(warehouseId: string) {
    return this.prisma.zone.findMany({
      where: { warehouseId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: string) {
    const zone = await this.prisma.zone.findUnique({
      where: { id },
    });

    if (!zone) {
      throw new WmsException(
        ErrorCodes.SYS_NOT_FOUND,
        `Zone with ID ${id} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    return zone;
  }

  async update(id: string, data: UpdateZoneDto) {
    await this.findById(id);

    const updateData: Prisma.ZoneUpdateInput = {};

    if (data.code !== undefined) {
      updateData.code = data.code.toUpperCase();
    }
    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.type !== undefined) {
      updateData.type = data.type;
    }
    if (data.tempClass !== undefined) {
      updateData.tempClass = data.tempClass;
    }
    if (data.hazmatAllowed !== undefined) {
      updateData.hazmatAllowed = data.hazmatAllowed;
    }

    return this.prisma.zone.update({
      where: { id },
      data: updateData,
    });
  }
}
