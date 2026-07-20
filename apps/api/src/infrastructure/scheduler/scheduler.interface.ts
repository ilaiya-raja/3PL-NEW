export interface ScheduledJobDefinition {
  name: string;
  cronExpression: string;
  handler: () => Promise<void> | void;
}

export interface IJobScheduler {
  registerJob(job: ScheduledJobDefinition): void;
  unregisterJob(name: string): void;
}

export const JOB_SCHEDULER = Symbol('JOB_SCHEDULER');
