import type { PaginationMeta } from '@wms/types';

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
  search?: string;
}

export function createPaginationMeta(
  page: number,
  limit: number,
  total: number,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc',
): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    sortBy,
    sortOrder,
  };
}

export function calculatePagination(
  page: number,
  limit: number,
  total: number,
): Omit<PaginationMeta, 'sortBy' | 'sortOrder'> {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
