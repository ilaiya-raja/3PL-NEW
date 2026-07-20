import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GcsStorageService } from './storage/gcs-storage.service';
import { MinioStorageService } from './storage/minio-storage.service';
import { S3StorageService } from './storage/s3-storage.service';
import {
  STORAGE_SERVICE,
  type IStorageService,
} from './storage/storage.interface';
import { BullmqScheduler } from './scheduler/bullmq.scheduler';
import { NodeCronScheduler } from './scheduler/node-cron.scheduler';
import {
  JOB_SCHEDULER,
  type IJobScheduler,
} from './scheduler/scheduler.interface';
import { ResendMailService } from './mail/resend-mail.service';
import { SesMailService } from './mail/ses-mail.service';
import { SmtpMailService } from './mail/smtp-mail.service';
import {
  MAIL_SERVICE,
  type IMailService,
} from './mail/mail.interface';

type StorageProvider = 'minio' | 's3' | 'gcs';
type QueueProvider = 'cron' | 'bullmq';
type MailProvider = 'smtp' | 'resend' | 'ses';

@Module({})
export class InfrastructureModule {
  static forRoot(): DynamicModule {
    return {
      module: InfrastructureModule,
      global: true,
      imports: [ConfigModule],
      providers: [
        MinioStorageService,
        S3StorageService,
        GcsStorageService,
        NodeCronScheduler,
        BullmqScheduler,
        SmtpMailService,
        ResendMailService,
        SesMailService,
        {
          provide: STORAGE_SERVICE,
          inject: [ConfigService, MinioStorageService, S3StorageService, GcsStorageService],
          useFactory: (
            configService: ConfigService,
            minioStorage: MinioStorageService,
            s3Storage: S3StorageService,
            gcsStorage: GcsStorageService,
          ): IStorageService => {
            const provider = configService.get<string>(
              'STORAGE_PROVIDER',
              'minio',
            ) as StorageProvider;

            switch (provider) {
              case 's3':
                return s3Storage;
              case 'gcs':
                return gcsStorage;
              case 'minio':
              default:
                return minioStorage;
            }
          },
        },
        {
          provide: JOB_SCHEDULER,
          inject: [ConfigService, NodeCronScheduler, BullmqScheduler],
          useFactory: (
            configService: ConfigService,
            nodeCronScheduler: NodeCronScheduler,
            bullmqScheduler: BullmqScheduler,
          ): IJobScheduler => {
            const provider = configService.get<string>(
              'QUEUE_PROVIDER',
              'cron',
            ) as QueueProvider;

            switch (provider) {
              case 'bullmq':
                return bullmqScheduler;
              case 'cron':
              default:
                return nodeCronScheduler;
            }
          },
        },
        {
          provide: MAIL_SERVICE,
          inject: [ConfigService, SmtpMailService, ResendMailService, SesMailService],
          useFactory: (
            configService: ConfigService,
            smtpMail: SmtpMailService,
            resendMail: ResendMailService,
            sesMail: SesMailService,
          ): IMailService => {
            const provider = configService.get<string>(
              'MAIL_PROVIDER',
              'smtp',
            ) as MailProvider;

            switch (provider) {
              case 'resend':
                return resendMail;
              case 'ses':
                return sesMail;
              case 'smtp':
              default:
                return smtpMail;
            }
          },
        },
      ],
      exports: [STORAGE_SERVICE, JOB_SCHEDULER, MAIL_SERVICE],
    };
  }
}
