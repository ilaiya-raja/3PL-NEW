import type { Warehouse, Zone, Location } from '@wms/db';
import { Decimal } from '@prisma/client/runtime/library';
import type { WarehouseDto, ZoneDto, LocationDto } from '@wms/types';

export function toWarehouseDto(warehouse: Warehouse): WarehouseDto {
  return {
    id: warehouse.id,
    code: warehouse.code,
    name: warehouse.name,
    address: warehouse.address as unknown as WarehouseDto['address'],
    active: warehouse.active,
    createdAt: warehouse.createdAt.toISOString(),
    updatedAt: warehouse.updatedAt.toISOString(),
  };
}

export function toZoneDto(zone: Zone): ZoneDto {
  return {
    id: zone.id,
    warehouseId: zone.warehouseId,
    code: zone.code,
    name: zone.name,
    type: zone.type as ZoneDto['type'],
    tempClass: zone.tempClass as ZoneDto['tempClass'],
    hazmatAllowed: zone.hazmatAllowed,
    createdAt: zone.createdAt.toISOString(),
    updatedAt: zone.updatedAt.toISOString(),
  };
}

export function toLocationDto(location: Location): LocationDto {
  const maxWeightKg = location.maxWeightKg;
  return {
    id: location.id,
    zoneId: location.zoneId,
    warehouseId: location.warehouseId,
    code: location.code,
    type: location.type as LocationDto['type'],
    clientId: location.clientId,
    pickSequence: location.pickSequence,
    maxWeightKg:
      maxWeightKg !== null && typeof maxWeightKg === 'object' && 'toString' in maxWeightKg
        ? (maxWeightKg as Decimal).toString()
        : maxWeightKg,
    dims: location.dims as unknown as LocationDto['dims'],
    active: location.active,
    createdAt: location.createdAt.toISOString(),
    updatedAt: location.updatedAt.toISOString(),
  };
}
