import { Injectable, NotImplementedException } from '@nestjs/common';
import type {
  IJobScheduler,
  ScheduledJobDefinition,
} from './scheduler.interface';

@Injectable()
export class BullmqScheduler implements IJobScheduler {
  registerJob(_job: ScheduledJobDefinition): void {
    throw new NotImplementedException('BullMQ scheduler is not implemented');
  }

  unregisterJob(_name: string): void {
    throw new NotImplementedException('BullMQ scheduler is not implemented');
  }
}
