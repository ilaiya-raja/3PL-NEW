import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OutboundController } from './outbound.controller';
import { OutboundService } from './outbound.service';
import { OutboundRepository } from './outbound.repository';

@Module({
  imports: [DatabaseModule, InventoryModule],
  controllers: [OutboundController],
  providers: [OutboundService, OutboundRepository],
  exports: [OutboundService],
})
export class OutboundModule {}
