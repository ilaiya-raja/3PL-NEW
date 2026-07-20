import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { clientApi } from "@/lib/api-client";
import { listQueryOptions } from "./query-options";

export interface DashboardActivity {
  id: string;
  type: string;
  title: string;
  at: string;
}

export interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  receiptsToday: number;
  lowStockItems: number;
  activeWaves: number;
  openOrders: number;
  lateShipments: number;
  activeHolds: number;
  inboundDueToday: number;
  pendingAdjustments: number;
  ordersByStatus: Array<{ name: string; value: number }>;
  recentActivity: DashboardActivity[];
}

export function useDashboardStats() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      const response = await clientApi<DashboardStats>(
        "/dashboard/stats",
        session?.accessToken || ""
      );
      return response.data;
    },
    enabled: !!session?.accessToken,
    ...listQueryOptions,
  });
}
