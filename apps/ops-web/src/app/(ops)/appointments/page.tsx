'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { WarehouseFilter } from '@/components/shared/warehouse-filter';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  addDays,
  format,
  isSameDay,
  parseISO,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  LogIn,
  Plus,
} from 'lucide-react';
import { useWarehouses } from '@/hooks/use-warehouses';
import {
  useAppointments,
  useCheckInAppointment,
  useCreateAppointment,
  type AppointmentRow,
} from '@/hooks/use-warehouse-ops';
import { cn } from '@/lib/utils';

export default function AppointmentsPage() {
  const [warehouseId, setWarehouseId] = useState<string>();
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [form, setForm] = useState({
    dockCode: 'RCV-D1',
    scheduledAt: '',
    durationMinutes: '60',
    carrierName: '',
    vehicleRef: '',
    driverName: '',
  });

  const { data: whResult } = useWarehouses(0, 50);
  const warehouses = whResult?.data ?? [];

  useEffect(() => {
    if (!warehouseId && warehouses.length > 0) setWarehouseId(warehouses[0].id);
  }, [warehouseId, warehouses]);

  const { data, isLoading } = useAppointments(warehouseId, 0, 100);
  const createAppt = useCreateAppointment(warehouseId);
  const checkIn = useCheckInAppointment(warehouseId);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, AppointmentRow[]>();
    for (const day of days) {
      map.set(format(day, 'yyyy-MM-dd'), []);
    }
    for (const appt of data?.data ?? []) {
      const key = format(parseISO(appt.scheduledAt), 'yyyy-MM-dd');
      if (!map.has(key)) continue;
      map.get(key)!.push(appt);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
      );
    }
    return map;
  }, [data?.data, days]);

  const openCreateForDay = (day: Date) => {
    setSelectedDay(day);
    const defaultTime = format(day, "yyyy-MM-dd'T'09:00");
    setForm((f) => ({ ...f, scheduledAt: defaultTime }));
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!warehouseId || !form.scheduledAt) return;
    await createAppt.mutateAsync({
      warehouseId,
      dockCode: form.dockCode,
      scheduledAt: new Date(form.scheduledAt).toISOString(),
      durationMinutes: Number(form.durationMinutes) || 60,
      carrierName: form.carrierName || undefined,
      vehicleRef: form.vehicleRef || undefined,
      driverName: form.driverName || undefined,
    });
    setCreateOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dock calendar"
        description="Schedule appointments and check carriers in"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <WarehouseFilter
              warehouses={warehouses}
              value={warehouseId}
              onChange={setWarehouseId}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => setWeekStart((d) => addDays(d, -7))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
              }
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setWeekStart((d) => addDays(d, 7))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button onClick={() => openCreateForDay(new Date())}>
              <Plus className="mr-2 h-4 w-4" />
              Schedule
            </Button>
          </div>
        }
      />

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading appointments…
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-7">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const appts = byDay.get(key) ?? [];
          const isToday = isSameDay(day, new Date());
          return (
            <Card
              key={key}
              className={cn(
                'min-h-[220px]',
                isToday && 'border-primary/60 shadow-sm',
              )}
            >
              <CardHeader className="space-y-1 p-3 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    {format(day, 'EEE d MMM')}
                  </CardTitle>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => openCreateForDay(startOfDay(day))}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                {appts.length === 0 && (
                  <p className="text-xs text-muted-foreground">No docks</p>
                )}
                {appts.map((appt) => (
                  <div
                    key={appt.id}
                    className="rounded-md border bg-background p-2 text-xs"
                  >
                    <div className="mb-1 flex items-center justify-between gap-1">
                      <span className="font-medium">
                        {format(parseISO(appt.scheduledAt), 'HH:mm')} ·{' '}
                        {appt.dockCode}
                      </span>
                      <StatusBadge status={appt.status} />
                    </div>
                    <p className="text-muted-foreground">
                      {appt.carrierName ?? 'Carrier'}{' '}
                      {appt.vehicleRef ? `· ${appt.vehicleRef}` : ''}
                    </p>
                    {appt.driverName && (
                      <p className="text-muted-foreground">{appt.driverName}</p>
                    )}
                    {appt.status === 'SCHEDULED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 h-7 w-full"
                        disabled={checkIn.isPending}
                        onClick={() => checkIn.mutate(appt.id)}
                      >
                        <LogIn className="mr-1 h-3 w-3" />
                        Check in
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Schedule appointment
              {selectedDay ? ` · ${format(selectedDay, 'dd MMM')}` : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>Dock code</Label>
              <Input
                value={form.dockCode}
                onChange={(e) => setForm({ ...form, dockCode: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Scheduled at</Label>
              <Input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) =>
                  setForm({ ...form, scheduledAt: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Duration (minutes)</Label>
              <Input
                value={form.durationMinutes}
                onChange={(e) =>
                  setForm({ ...form, durationMinutes: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Carrier</Label>
              <Input
                value={form.carrierName}
                onChange={(e) =>
                  setForm({ ...form, carrierName: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Vehicle</Label>
              <Input
                value={form.vehicleRef}
                onChange={(e) =>
                  setForm({ ...form, vehicleRef: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Driver</Label>
              <Input
                value={form.driverName}
                onChange={(e) =>
                  setForm({ ...form, driverName: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createAppt.isPending || !form.scheduledAt}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
