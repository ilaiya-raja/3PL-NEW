import { AlertTriangle } from "lucide-react";
import Link from "next/link";

interface LicenseBannerProps {
  daysRemaining: number;
}

export function LicenseBanner({ daysRemaining }: LicenseBannerProps) {
  if (daysRemaining > 30) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
      <div className="container py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-900 dark:text-amber-100">
              <strong>License expiring soon:</strong> Your license expires in{" "}
              <span className="font-bold tabular-nums">{daysRemaining}</span>{" "}
              {daysRemaining === 1 ? "day" : "days"}.
            </p>
          </div>
          <Link
            href="/settings/license"
            className="text-sm font-medium text-amber-900 dark:text-amber-100 hover:underline"
          >
            Renew License
          </Link>
        </div>
      </div>
    </div>
  );
}
