import { Injectable, HttpStatus } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@wms/db';
import { ErrorCodes } from '@wms/types';
import { PrismaService } from '../../database/prisma.service';
import { WmsException } from '../../common/exceptions/wms.exception';
import type { CreateLocationDto } from './dto/create-location.dto';
import type { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class LocationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(zoneId: string, warehouseId: string, data: CreateLocationDto) {
    const exists = await this.prisma.location.findFirst({
      where: {
        warehouseId,
        code: data.code.toUpperCase(),
      },
    });

    if (exists) {
      throw new WmsException(
        ErrorCodes.VAL_VALIDATION_FAILED,
        `Location with code ${data.code} already exists in this warehouse`,
        HttpStatus.CONFLICT,
      );
    }

    return this.prisma.location.create({
      data: {
        zoneId,
        warehouseId,
        code: data.code.toUpperCase(),
        type: data.type,
        clientId: data.clientId ?? null,
        pickSequence: data.pickSequence ?? null,
        maxWeightKg: data.maxWeightKg ? new Decimal(data.maxWeightKg) : null,
        dims: data.dims ? (data.dims as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        active: data.active ?? true,
      },
    });
  }

  async createBulk(
    zoneId: string,
    warehouseId: string,
    locations: CreateLocationDto[],
  ) {
    const codes = locations.map((loc) => loc.code.toUpperCase());
    const existing = await this.prisma.location.findMany({
      where: {
        warehouseId,
        code: { in: codes },
      },
      select: { code: true },
    });

    if (existing.length > 0) {
      throw new WmsException(
        ErrorCodes.VAL_VALIDATION_FAILED,
        `Some location codes already exist: ${existing.map((e) => e.code).join(', ')}`,
        HttpStatus.CONFLICT,
      );
    }

    const data = locations.map((loc) => ({
      zoneId,
      warehouseId,
      code: loc.code.toUpperCase(),
      type: loc.type,
      clientId: loc.clientId ?? null,
      pickSequence: loc.pickSequence ?? null,
      maxWeightKg: loc.maxWeightKg ? new Decimal(loc.maxWeightKg) : null,
      dims: loc.dims ? (loc.dims as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      active: loc.active ?? true,
    }));

    return this.prisma.location.createMany({ data });
  }

  async findByZoneId(zoneId: string) {
    return this.prisma.location.findMany({
      where: { zoneId },
      orderBy: { pickSequence: 'asc' },
    });
  }

  async findById(id: string) {
    const location = await this.prisma.location.findUnique({
      where: { id },
    });

    if (!location) {
      throw new WmsException(
        ErrorCodes.SYS_NOT_FOUND,
        `Location with ID ${id} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    return location;
  }

  async update(id: string, data: UpdateLocationDto) {
    await this.findById(id);

    const updateData: Prisma.LocationUpdateInput = {};

    if (data.code !== undefined) {
      updateData.code = data.code.toUpperCase();
    }
    if (data.type !== undefined) {
      updateData.type = data.type;
    }
    if (data.clientId !== undefined) {
      if (data.clientId === null) {
        updateData.client = { disconnect: true };
      } else {
        updateData.client = { connect: { id: data.clientId } };
      }
    }
    if (data.pickSequence !== undefined) {
      updateData.pickSequence = data.pickSequence;
    }
    if (data.maxWeightKg !== undefined) {
      updateData.maxWeightKg = data.maxWeightKg ? new Decimal(data.maxWeightKg) : null;
    }
    if (data.dims !== undefined) {
      updateData.dims = data.dims ? (data.dims as unknown as Prisma.InputJsonValue) : Prisma.JsonNull;
    }
    if (data.active !== undefined) {
      updateData.active = data.active;
    }

    return this.prisma.location.update({
      where: { id },
      data: updateData,
    });
  }

  async assignClient(id: string, clientId: string) {
    await this.findById(id);

    return this.prisma.location.update({
      where: { id },
      data: { client: { connect: { id: clientId } } },
    });
  }

  async releaseClient(id: string) {
    await this.findById(id);

    return this.prisma.location.update({
      where: { id },
      data: { client: { disconnect: true } },
    });
  }

  async getSpaceUtilization(warehouseId: string) {
    const zones = await this.prisma.zone.findMany({
      where: { warehouseId },
      include: {
        locations: {
          select: {
            id: true,
            clientId: true,
          },
        },
      },
    });

    const byZone = zones.map((zone) => {
      const totalLocations = zone.locations.length;
      const occupiedLocations = zone.locations.filter(
        (loc) => loc.clientId !== null,
      ).length;
      const utilizationPct =
        totalLocations > 0
          ? Math.round((occupiedLocations / totalLocations) * 100 * 100) / 100
          : 0;

      return {
        zoneId: zone.id,
        zoneCode: zone.code,
        zoneName: zone.name,
        totalLocations,
        occupiedLocations,
        utilizationPct,
      };
    });

    const totalLocations = byZone.reduce((sum, z) => sum + z.totalLocations, 0);
    const occupiedLocations = byZone.reduce(
      (sum, z) => sum + z.occupiedLocations,
      0,
    );
    const utilizationPct =
      totalLocations > 0
        ? Math.round((occupiedLocations / totalLocations) * 100 * 100) / 100
        : 0;

    return {
      warehouseId,
      totalLocations,
      occupiedLocations,
      utilizationPct,
      byZone,
    };
  }
}
