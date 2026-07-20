import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { CommonModule } from './common/common.module';
import { DatabaseModule } from './database/database.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { LicenseModule } from './license/license.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { InboundModule } from './modules/inbound/inbound.module';
import { ClientModule } from './modules/client/client.module';
import { WarehouseModule } from './modules/warehouse/warehouse.module';
import { ItemModule } from './modules/item/item.module';
import { OutboundModule } from './modules/outbound/outbound.module';
import { OpsUserModule } from './modules/ops-user/ops-user.module';
import { DocumentModule } from './modules/document/document.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { PortalModule } from './modules/portal/portal.module';
import { ReportsModule } from './modules/reports/reports.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { BillingModule } from './modules/billing/billing.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    ScheduleModule.forRoot(),
    DatabaseModule,
    InfrastructureModule.forRoot(),
    LicenseModule,
    CommonModule,
    AuthModule,
    HealthModule,
    InventoryModule,
    InboundModule,
    ClientModule,
    WarehouseModule,
    ItemModule,
    OutboundModule,
    OpsUserModule,
    DocumentModule,
    DashboardModule,
    PortalModule,
    ReportsModule,
    NotificationsModule,
    BillingModule,
  ],
})
export class AppModule {}
