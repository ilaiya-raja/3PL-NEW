import type { Item } from '@wms/db';
import type { ItemDto } from '@wms/types';
import { Decimal } from '@prisma/client/runtime/library';

export function toItemDto(item: Item): ItemDto {
  const minShipShelfPct = item.minShipShelfPct;
  return {
    id: item.id,
    clientId: item.clientId,
    sku: item.sku,
    description: item.description,
    uom: item.uom,
    packConfig: item.packConfig as unknown as ItemDto['packConfig'],
    lotTracked: item.lotTracked,
    serialTracked: item.serialTracked,
    shelfLifeDays: item.shelfLifeDays,
    minShipShelfPct:
      minShipShelfPct !== null && typeof minShipShelfPct === 'object' && 'toNumber' in minShipShelfPct
        ? (minShipShelfPct as Decimal).toNumber()
        : minShipShelfPct,
    hazmatClass: item.hazmatClass,
    tempClass: item.tempClass as ItemDto['tempClass'],
    velocityClass: item.velocityClass,
    active: item.active,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}
