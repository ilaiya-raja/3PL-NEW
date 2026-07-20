import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { InventoryModule } from '../inventory/inventory.module';
import { InboundRepository } from './inbound.repository';
import { InboundService } from './inbound.service';
import { InboundController } from './inbound.controller';

@Module({
  imports: [DatabaseModule, InventoryModule],
  controllers: [InboundController],
  providers: [InboundRepository, InboundService],
  exports: [InboundService, InboundRepository],
})
export class InboundModule {}
