import { Decimal } from '@prisma/client/runtime/library';
import { AllocationStrategy } from '@wms/types';
import {
  sortLotsForAllocation,
  lotPassesShelfLife,
  getAvailableQuantity,
  type LotForAllocation,
  type ItemWithShelfLife,
} from './allocation.helpers';

describe('Allocation Helpers', () => {
  describe('sortLotsForAllocation', () => {
    const createLot = (
      id: string,
      receivedAt: Date,
      expiryDate: Date | null,
    ): LotForAllocation => ({
      id,
      itemId: 'item-1',
      qtyOnHand: new Decimal(100),
      qtyAllocated: new Decimal(0),
      expiryDate,
      receivedAt,
      locationId: 'loc-1',
    });

    it('should sort by received date for FIFO strategy', () => {
      const lots: LotForAllocation[] = [
        createLot('lot-3', new Date('2024-03-01'), null),
        createLot('lot-1', new Date('2024-01-01'), null),
        createLot('lot-2', new Date('2024-02-01'), null),
      ];

      const sorted = sortLotsForAllocation(lots, AllocationStrategy.FIFO);

      expect(sorted[0].id).toBe('lot-1');
      expect(sorted[1].id).toBe('lot-2');
      expect(sorted[2].id).toBe('lot-3');
    });

    it('should sort by expiry date first for FEFO strategy', () => {
      const lots: LotForAllocation[] = [
        createLot('lot-3', new Date('2024-01-01'), new Date('2024-12-31')),
        createLot('lot-1', new Date('2024-03-01'), new Date('2024-06-30')),
        createLot('lot-2', new Date('2024-02-01'), new Date('2024-09-30')),
      ];

      const sorted = sortLotsForAllocation(lots, AllocationStrategy.FEFO);

      expect(sorted[0].id).toBe('lot-1'); // Expires 2024-06-30
      expect(sorted[1].id).toBe('lot-2'); // Expires 2024-09-30
      expect(sorted[2].id).toBe('lot-3'); // Expires 2024-12-31
    });

    it('should use received date as tiebreaker for FEFO when expiry dates are equal', () => {
      const expiryDate = new Date('2024-12-31');
      const lots: LotForAllocation[] = [
        createLot('lot-2', new Date('2024-02-01'), expiryDate),
        createLot('lot-1', new Date('2024-01-01'), expiryDate),
        createLot('lot-3', new Date('2024-03-01'), expiryDate),
      ];

      const sorted = sortLotsForAllocation(lots, AllocationStrategy.FEFO);

      expect(sorted[0].id).toBe('lot-1'); // Same expiry, received earliest
      expect(sorted[1].id).toBe('lot-2');
      expect(sorted[2].id).toBe('lot-3');
    });

    it('should place lots with expiry dates before lots without for FEFO', () => {
      const lots: LotForAllocation[] = [
        createLot('lot-no-expiry', new Date('2024-01-01'), null),
        createLot('lot-with-expiry', new Date('2024-03-01'), new Date('2024-12-31')),
      ];

      const sorted = sortLotsForAllocation(lots, AllocationStrategy.FEFO);

      expect(sorted[0].id).toBe('lot-with-expiry');
      expect(sorted[1].id).toBe('lot-no-expiry');
    });

    it('should handle lots with no expiry dates for FEFO by using received date', () => {
      const lots: LotForAllocation[] = [
        createLot('lot-3', new Date('2024-03-01'), null),
        createLot('lot-1', new Date('2024-01-01'), null),
        createLot('lot-2', new Date('2024-02-01'), null),
      ];

      const sorted = sortLotsForAllocation(lots, AllocationStrategy.FEFO);

      expect(sorted[0].id).toBe('lot-1');
      expect(sorted[1].id).toBe('lot-2');
      expect(sorted[2].id).toBe('lot-3');
    });
  });

  describe('lotPassesShelfLife', () => {
    const createLot = (expiryDate: Date | null): LotForAllocation => ({
      id: 'lot-1',
      itemId: 'item-1',
      qtyOnHand: new Decimal(100),
      qtyAllocated: new Decimal(0),
      expiryDate,
      receivedAt: new Date(),
      locationId: 'loc-1',
    });

    const createItem = (
      shelfLifeDays: number | null,
      minShipShelfPct: number | null,
    ): ItemWithShelfLife => ({
      id: 'item-1',
      shelfLifeDays,
      minShipShelfPct: minShipShelfPct ? new Decimal(minShipShelfPct) : null,
    });

    it('should pass if item has no shelf life constraints', () => {
      const lot = createLot(new Date('2024-12-31'));
      const item = createItem(null, null);

      expect(lotPassesShelfLife(lot, item)).toBe(true);
    });

    it('should pass if lot has no expiry date', () => {
      const lot = createLot(null);
      const item = createItem(365, 50);

      expect(lotPassesShelfLife(lot, item)).toBe(true);
    });

    it('should pass if remaining shelf life >= minShipShelfPct', () => {
      // Item has 365 day shelf life, requires 50% remaining
      const item = createItem(365, 50);

      // Lot expires 200 days from now
      // Remaining % = (200 days * 24 * 60 * 60 * 1000) / (365 * 24 * 60 * 60 * 1000) * 100 = 54.79%
      const now = new Date('2024-01-01');
      const expiryDate = new Date('2024-07-19'); // ~200 days later
      const lot = createLot(expiryDate);

      expect(lotPassesShelfLife(lot, item, now)).toBe(true);
    });

    it('should fail if remaining shelf life < minShipShelfPct', () => {
      // Item has 365 day shelf life, requires 50% remaining
      const item = createItem(365, 50);

      // Lot expires 100 days from now
      // Remaining % = (100 * 24 * 60 * 60 * 1000) / (365 * 24 * 60 * 60 * 1000) * 100 = 27.4%
      const now = new Date('2024-01-01');
      const expiryDate = new Date('2024-04-10'); // ~100 days later
      const lot = createLot(expiryDate);

      expect(lotPassesShelfLife(lot, item, now)).toBe(false);
    });

    it('should handle exact threshold match', () => {
      // Item has 100 day shelf life, requires 50% remaining
      const item = createItem(100, 50);

      // Lot expires exactly 50 days from now
      // Remaining % = 50%
      const now = new Date('2024-01-01');
      const expiryDate = new Date('2024-02-20'); // exactly 50 days later
      const lot = createLot(expiryDate);

      expect(lotPassesShelfLife(lot, item, now)).toBe(true);
    });

    it('should fail for already expired lots', () => {
      const item = createItem(365, 50);

      const now = new Date('2024-06-01');
      const expiryDate = new Date('2024-01-01'); // expired 5 months ago
      const lot = createLot(expiryDate);

      expect(lotPassesShelfLife(lot, item, now)).toBe(false);
    });

    it('should handle high minimum shelf life percentage requirement', () => {
      // Item has 365 day shelf life, requires 90% remaining
      const item = createItem(365, 90);

      // Lot expires 300 days from now (~82%)
      const now = new Date('2024-01-01');
      const expiryDate = new Date('2024-10-27');
      const lot = createLot(expiryDate);

      expect(lotPassesShelfLife(lot, item, now)).toBe(false);
    });
  });

  describe('getAvailableQuantity', () => {
    it('should calculate available quantity correctly', () => {
      const lot: LotForAllocation = {
        id: 'lot-1',
        itemId: 'item-1',
        qtyOnHand: new Decimal(100),
        qtyAllocated: new Decimal(30),
        expiryDate: null,
        receivedAt: new Date(),
        locationId: 'loc-1',
      };

      const available = getAvailableQuantity(lot);

      expect(available.toString()).toBe('70');
    });

    it('should return zero when fully allocated', () => {
      const lot: LotForAllocation = {
        id: 'lot-1',
        itemId: 'item-1',
        qtyOnHand: new Decimal(100),
        qtyAllocated: new Decimal(100),
        expiryDate: null,
        receivedAt: new Date(),
        locationId: 'loc-1',
      };

      const available = getAvailableQuantity(lot);

      expect(available.toString()).toBe('0');
    });

    it('should handle string inputs', () => {
      const lot: LotForAllocation = {
        id: 'lot-1',
        itemId: 'item-1',
        qtyOnHand: '100.500',
        qtyAllocated: '25.250',
        expiryDate: null,
        receivedAt: new Date(),
        locationId: 'loc-1',
      };

      const available = getAvailableQuantity(lot);

      expect(available.toString()).toBe('75.25');
    });

    it('should handle fractional quantities', () => {
      const lot: LotForAllocation = {
        id: 'lot-1',
        itemId: 'item-1',
        qtyOnHand: new Decimal('100.333'),
        qtyAllocated: new Decimal('50.111'),
        expiryDate: null,
        receivedAt: new Date(),
        locationId: 'loc-1',
      };

      const available = getAvailableQuantity(lot);

      expect(available.toString()).toBe('50.222');
    });
  });
});
