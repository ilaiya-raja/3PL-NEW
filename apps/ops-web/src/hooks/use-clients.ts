import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { clientApi } from "@/lib/api-client";
import { toast } from "sonner";
import { listQueryOptions } from "./query-options";

interface Client {
  id: string;
  code: string;
  legalName: string;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
}

interface PaginatedClients {
  items: Client[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

interface ClientsQueryResult {
  data: Client[];
  meta: PaginatedClients["meta"];
}

function mapClient(raw: Omit<Client, "name" | "contactName" | "contactEmail" | "contactPhone">): Client {
  return {
    ...raw,
    name: raw.legalName,
    contactName: "",
    contactEmail: "",
    contactPhone: "",
  };
}

export function useClients(pageIndex = 0, limit = 10) {
  const { data: session } = useSession();
  const page = pageIndex + 1;

  return useQuery<ClientsQueryResult>({
    queryKey: ["clients", page, limit],
    queryFn: async () => {
      const response = await clientApi<PaginatedClients>(
        `/clients?page=${page}&limit=${limit}`,
        session?.accessToken || ""
      );
      return {
        data: response.data.items.map(mapClient),
        meta: response.data.meta,
      };
    },
    enabled: !!session?.accessToken,
    ...listQueryOptions,
  });
}

export function useClient(id: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ["clients", id],
    queryFn: async () => {
      const response = await clientApi<Omit<Client, "name" | "contactName" | "contactEmail" | "contactPhone">>(
        `/clients/${id}`,
        session?.accessToken || ""
      );
      return mapClient(response.data);
    },
    enabled: !!session?.accessToken && !!id,
    ...listQueryOptions,
  });
}

export function useCreateClient() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      code: string;
      legalName: string;
      gstin?: string;
      status?: string;
    }) => {
      const response = await clientApi<Client>(
        "/clients",
        session?.accessToken || "",
        {
          method: "POST",
          body: JSON.stringify(data),
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client created successfully");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Failed to create client");
    },
  });
}

export interface ContractSlaDefinition {
  id: string;
  metric: string;
  targetValue: string;
  createdAt: string;
}

export interface ClientContract {
  id: string;
  clientId: string;
  startDate: string;
  endDate: string;
  minMonthlyCommit: string | null;
  renewalAlertDays: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  slaDefinitions?: ContractSlaDefinition[];
}

export function useClientContracts(clientId: string | undefined) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ["clients", clientId, "contracts"],
    queryFn: async () => {
      const response = await clientApi<ClientContract[]>(
        `/clients/${clientId}/contracts`,
        session?.accessToken || ""
      );
      return response.data;
    },
    enabled: !!session?.accessToken && !!clientId,
    ...listQueryOptions,
  });
}

export function useCreateContract(clientId: string | undefined) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      startDate: string;
      endDate: string;
      notes?: string;
    }) => {
      const response = await clientApi<ClientContract>(
        `/clients/${clientId}/contracts`,
        session?.accessToken || "",
        {
          method: "POST",
          body: JSON.stringify(data),
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients", clientId, "contracts"] });
      toast.success("Contract created");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Failed to create contract");
    },
  });
}

export function useAddContractSla(clientId: string | undefined) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contractId,
      metric,
      targetValue,
    }: {
      contractId: string;
      metric: string;
      targetValue: string;
    }) => {
      const response = await clientApi(
        `/clients/${clientId}/contracts/${contractId}/sla`,
        session?.accessToken || "",
        {
          method: "POST",
          body: JSON.stringify({ metric, targetValue }),
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients", clientId, "contracts"] });
      toast.success("SLA definition added");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Failed to add SLA");
    },
  });
}

export function useUpdateClient(id: string) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { legalName?: string; gstin?: string | null }) => {
      const response = await clientApi<Client>(
        `/clients/${id}`,
        session?.accessToken || "",
        {
          method: "PATCH",
          body: JSON.stringify(data),
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client updated successfully");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Failed to update client");
    },
  });
}
