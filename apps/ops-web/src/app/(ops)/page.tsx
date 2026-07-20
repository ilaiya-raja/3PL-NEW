"use client";

import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardStats } from "@/hooks/use-dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package,
  Clock,
  CheckCircle,
  TruckIcon,
  AlertTriangle,
  Waves,
  ShieldAlert,
  ClipboardList,
  PackageOpen,
} from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { formatDistanceToNow } from "date-fns";

const activityDotClass: Record<string, string> = {
  ORDER: "bg-blue-500",
  INBOUND: "bg-emerald-500",
  HOLD: "bg-amber-500",
  ADJUSTMENT: "bg-violet-500",
};

export default function DashboardPage() {
  const { data: stats, isLoading } = useDashboardStats();

  if (isLoading) {
    return (
      <div>
        <PageHeader
          title="Dashboard"
          description="Overview of warehouse operations"
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const ordersByStatus = stats?.ordersByStatus ?? [];
  const recentActivity = stats?.recentActivity ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of warehouse operations"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <KpiCard
          title="Open Orders"
          value={stats?.openOrders ?? stats?.pendingOrders ?? 0}
          icon={PackageOpen}
        />
        <KpiCard
          title="Late Shipments"
          value={stats?.lateShipments ?? 0}
          icon={AlertTriangle}
        />
        <KpiCard
          title="Active Holds"
          value={stats?.activeHolds ?? 0}
          icon={ShieldAlert}
        />
        <KpiCard
          title="Inbound Due Today"
          value={stats?.inboundDueToday ?? 0}
          icon={TruckIcon}
        />
        <KpiCard
          title="Pending Adjustments"
          value={stats?.pendingAdjustments ?? 0}
          icon={ClipboardList}
        />
        <KpiCard
          title="Total Orders"
          value={stats?.totalOrders || 0}
          icon={Package}
        />
        <KpiCard
          title="Pending Orders"
          value={stats?.pendingOrders || 0}
          icon={Clock}
        />
        <KpiCard
          title="Completed Today"
          value={stats?.completedOrders || 0}
          icon={CheckCircle}
        />
        <KpiCard
          title="Receipts Today"
          value={stats?.receiptsToday || 0}
          icon={TruckIcon}
        />
        <KpiCard
          title="Low Stock Items"
          value={stats?.lowStockItems || 0}
          icon={AlertTriangle}
        />
        <KpiCard
          title="Active Waves"
          value={stats?.activeWaves || 0}
          icon={Waves}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Orders by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {ordersByStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground">No order data</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={ordersByStatus}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          activityDotClass[item.type] ?? "bg-muted-foreground"
                        }`}
                      />
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(item.at), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
