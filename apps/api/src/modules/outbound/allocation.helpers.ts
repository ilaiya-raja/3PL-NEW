import { Decimal } from '@prisma/client/runtime/library';
import { AllocationStrategy } from '@wms/types';

export interface LotForAllocation {
  id: string;
  itemId: string;
  qtyOnHand: Decimal | string;
  qtyAllocated: Decimal | string;
  expiryDate: Date | null;
  receivedAt: Date;
  locationId: string | null;
}

export interface ItemWithShelfLife {
  id: string;
  shelfLifeDays: number | null;
  minShipShelfPct: Decimal | string | null;
}

/**
 * Sorts lots according to allocation strategy
 * FEFO: First Expiry, First Out (expiry date ASC, then received date ASC)
 * FIFO: First In, First Out (received date ASC)
 */
export function sortLotsForAllocation(
  lots: LotForAllocation[],
  strategy: AllocationStrategy,
): LotForAllocation[] {
  const sorted = [...lots];

  if (strategy === 'FEFO') {
    sorted.sort((a, b) => {
      // FEFO: Sort by expiry date first (nulls last), then by received date
      if (a.expiryDate && b.expiryDate) {
        const expiryDiff = a.expiryDate.getTime() - b.expiryDate.getTime();
        if (expiryDiff !== 0) return expiryDiff;
      } else if (a.expiryDate && !b.expiryDate) {
        return -1; // a has expiry, b doesn't -> a comes first
      } else if (!a.expiryDate && b.expiryDate) {
        return 1; // b has expiry, a doesn't -> b comes first
      }

      // If expiry dates are equal or both null, sort by received date
      return a.receivedAt.getTime() - b.receivedAt.getTime();
    });
  } else {
    // FIFO: Sort by received date only
    sorted.sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
  }

  return sorted;
}

/**
 * Checks if a lot passes the minimum shipping shelf life percentage requirement
 * Returns true if:
 * - Item has no shelf life requirements, OR
 * - Lot has no expiry date, OR
 * - Remaining shelf life percentage >= minShipShelfPct
 */
export function lotPassesShelfLife(
  lot: LotForAllocation,
  item: ItemWithShelfLife,
  now: Date = new Date(),
): boolean {
  // No shelf life constraints configured
  if (!item.shelfLifeDays || !item.minShipShelfPct) {
    return true;
  }

  // Lot has no expiry date
  if (!lot.expiryDate) {
    return true;
  }

  const shelfLifeDays = item.shelfLifeDays;
  const minPct = parseFloat(
    typeof item.minShipShelfPct === 'string'
      ? item.minShipShelfPct
      : item.minShipShelfPct.toString(),
  );

  const expiryDate = new Date(lot.expiryDate);
  const totalShelfLifeMs = shelfLifeDays * 24 * 60 * 60 * 1000;
  const remainingMs = expiryDate.getTime() - now.getTime();
  const remainingPct = (remainingMs / totalShelfLifeMs) * 100;

  return remainingPct >= minPct;
}

/**
 * Filters lots that have available quantity for allocation
 */
export function getAvailableQuantity(lot: LotForAllocation): Decimal {
  const onHand = new Decimal(
    typeof lot.qtyOnHand === 'string'
      ? lot.qtyOnHand
      : lot.qtyOnHand.toString(),
  );
  const allocated = new Decimal(
    typeof lot.qtyAllocated === 'string'
      ? lot.qtyAllocated
      : lot.qtyAllocated.toString(),
  );

  return onHand.minus(allocated);
}
