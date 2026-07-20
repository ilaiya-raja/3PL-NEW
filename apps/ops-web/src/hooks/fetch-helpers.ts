'use client';

export interface ListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
}

export interface ApiListResponse<T> {
  data: T[] | { items: T[]; meta?: ListMeta };
  pagination?: ListMeta;
  meta?: ListMeta;
}

export function unwrapDataList<T>(response: unknown): {
  data: T[];
  meta: ListMeta;
} {
  const res = response as ApiListResponse<T>;
  const payload = res?.data;

  if (Array.isArray(payload)) {
    return {
      data: payload as T[],
      meta:
        res.pagination ??
        res.meta ?? {
          total: payload.length,
          page: 1,
          limit: payload.length || 20,
        },
    };
  }

  if (payload && typeof payload === 'object' && 'items' in payload) {
    const items = (payload.items ?? []) as T[];
    return {
      data: items,
      meta:
        payload.meta ??
        res.meta ??
        res.pagination ?? {
          total: items.length,
          page: 1,
          limit: items.length || 20,
        },
    };
  }

  return { data: [], meta: { total: 0, page: 1, limit: 20 } };
}
