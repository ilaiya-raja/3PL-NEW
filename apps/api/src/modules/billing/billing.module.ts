import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { LicenseModule } from '../../license/license.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingMeterJob } from './billing-meter.job';

@Module({
  imports: [DatabaseModule, LicenseModule],
  controllers: [BillingController],
  providers: [BillingService, BillingMeterJob],
  exports: [BillingService],
})
export class BillingModule {}
