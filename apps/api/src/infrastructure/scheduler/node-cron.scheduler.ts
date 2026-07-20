import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from '@nestjs/schedule/node_modules/cron';
import type {
  IJobScheduler,
  ScheduledJobDefinition,
} from './scheduler.interface';

@Injectable()
export class NodeCronScheduler implements IJobScheduler {
  private readonly logger = new Logger(NodeCronScheduler.name);

  constructor(private readonly schedulerRegistry: SchedulerRegistry) {}

  registerJob(job: ScheduledJobDefinition): void {
    if (this.schedulerRegistry.doesExist('cron', job.name)) {
      this.unregisterJob(job.name);
    }

    const cronJob = new CronJob(job.cronExpression, async () => {
      this.logger.debug(`Running scheduled job: ${job.name}`);
      await job.handler();
    });

    this.schedulerRegistry.addCronJob(job.name, cronJob);
    cronJob.start();
    this.logger.log(`Registered cron job: ${job.name} (${job.cronExpression})`);
  }

  unregisterJob(name: string): void {
    if (!this.schedulerRegistry.doesExist('cron', name)) {
      return;
    }

    const cronJob = this.schedulerRegistry.getCronJob(name);
    cronJob.stop();
    this.schedulerRegistry.deleteCronJob(name);
    this.logger.log(`Unregistered cron job: ${name}`);
  }
}
