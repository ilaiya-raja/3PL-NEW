'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useActivateLicense, useLicenseStatus } from '@/hooks/use-license';

export default function SettingsLicensePage() {
  const [licenseKey, setLicenseKey] = useState('');
  const { data: license, isLoading } = useLicenseStatus();
  const activate = useActivateLicense();

  if (isLoading) {
    return <Skeleton className="h-96" />;
  }

  if (!license) {
    return <p className="text-sm text-muted-foreground">License unavailable</p>;
  }

  const limitEntries = Object.entries(license.limits ?? {});

  return (
    <div className="space-y-6">
      <PageHeader title="License" description="Manage your WMS license" />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>License Information</CardTitle>
            <CardDescription>{license.customerName}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Edition</p>
              <Badge className="mt-1">{license.edition}</Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Key</p>
              <p className="mt-1 text-sm font-mono">{license.maskedKey}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Expires</p>
              <p className="mt-1 text-sm">
                {format(new Date(license.expiresAt), 'dd MMM yyyy')}
              </p>
              <p
                className={`mt-1 text-sm ${
                  license.daysRemaining < 30
                    ? 'text-amber-600'
                    : 'text-muted-foreground'
                }`}
              >
                {license.daysRemaining} days remaining
                {license.inGracePeriod ? ' (grace period)' : ''}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Features
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {license.features.map((f) => (
                  <Badge key={f} variant="outline">
                    {f}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activate License</CardTitle>
            <CardDescription>Enter your license key</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="licenseKey">License Key</Label>
              <Input
                id="licenseKey"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="XXXX-XXXX-XXXX"
              />
            </div>
            <Button
              disabled={!licenseKey || activate.isPending}
              onClick={() => activate.mutate(licenseKey)}
            >
              Activate
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usage Limits</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {limitEntries.map(([key, lim]) => {
            const max = lim.max < 0 ? lim.current || 1 : lim.max;
            const pct =
              lim.max < 0 ? 0 : Math.min(100, (lim.current / Math.max(max, 1)) * 100);
            return (
              <div key={key} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="capitalize">{key}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {lim.current} / {lim.max < 0 ? '∞' : lim.max}
                  </span>
                </div>
                <Progress value={pct} className="h-2" />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
