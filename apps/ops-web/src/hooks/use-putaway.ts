'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { clientApi } from '@/lib/api-client';
import { listQueryOptions } from './query-options';

export interface PutawaySuggestion {
  locationId: string;
  code: string;
  type: string;
  zoneType: string;
  zoneName: string;
  tempClass: string;
  hazmatAllowed: boolean;
}

export interface PutawaySuggestResult {
  lotId: string;
  itemId: string;
  sku: string;
  qtyOnHand: string;
  suggestions: PutawaySuggestion[];
}

export function usePutawaySuggest(clientId: string | undefined, lotId: string | undefined) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['putaway', 'suggest', clientId, lotId],
    queryFn: async () => {
      const response = await clientApi<PutawaySuggestResult>(
        `/clients/${clientId}/putaway/suggest/${lotId}`,
        session?.accessToken || '',
      );
      return response.data;
    },
    enabled: !!session?.accessToken && !!clientId && !!lotId,
    ...listQueryOptions,
  });
}

export function useConfirmPutaway(clientId: string | undefined) {
  const { data: session } = useSession();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      lotId,
      locationId,
    }: {
      lotId: string;
      locationId: string;
    }) => {
      const response = await clientApi(
        `/clients/${clientId}/lots/${lotId}/putaway`,
        session?.accessToken || '',
        {
          method: 'POST',
          body: JSON.stringify({ locationId }),
        },
      );
      return response.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['putaway'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Putaway confirmed');
    },
    onError: (e: Error) => toast.error(e.message || 'Putaway failed'),
  });
}
