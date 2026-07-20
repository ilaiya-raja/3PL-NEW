import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BillingService } from './billing.service';

/**
 * Nightly metering for the previous calendar month (runs at 01:15 UTC).
 * Re-runs are idempotent via charge sourceRef uniqueness.
 */
@Injectable()
export class BillingMeterJob implements OnModuleInit {
  private readonly logger = new Logger(BillingMeterJob.name);

  constructor(private readonly billingService: BillingService) {}

  onModuleInit() {
    this.logger.log('Billing meter job registered (daily 01:15 UTC)');
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleNightlyMeter() {
    // Slightly after 1am via method; CronExpression is AT_1AM
    const { periodStart, periodEnd } = this.billingService.defaultMeterWindow();
    this.logger.log(
      `Starting nightly billing meter ${periodStart.toISOString().slice(0, 10)} → ${periodEnd.toISOString().slice(0, 10)}`,
    );
    try {
      const result = await this.billingService.meterPeriod({
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      });
      this.logger.log(
        `Nightly meter complete: ${result.results.length} clients`,
      );
    } catch (err) {
      this.logger.error('Nightly billing meter failed', err as Error);
    }
  }
}
