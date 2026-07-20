export const LIST_STALE_TIME_MS = 30_000;

export const listQueryOptions = {
  staleTime: LIST_STALE_TIME_MS,
} as const;
