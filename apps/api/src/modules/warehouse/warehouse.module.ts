import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { LicenseModule } from '../../license/license.module';
import {
  WarehouseController,
  ZoneController,
  LocationController,
} from './warehouse.controller';
import { WarehouseService } from './warehouse.service';
import { WarehouseRepository } from './warehouse.repository';
import { ZoneRepository } from './zone.repository';
import { LocationRepository } from './location.repository';

@Module({
  imports: [DatabaseModule, LicenseModule],
  controllers: [WarehouseController, ZoneController, LocationController],
  providers: [
    WarehouseService,
    WarehouseRepository,
    ZoneRepository,
    LocationRepository,
  ],
  exports: [WarehouseService, WarehouseRepository],
})
export class WarehouseModule {}
