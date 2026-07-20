import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import type { IStorageService, StorageUploadOptions } from './storage.interface';

@Injectable()
export class MinioStorageService implements IStorageService, OnModuleInit {
  private readonly logger = new Logger(MinioStorageService.name);
  private client!: Minio.Client;
  private bucket!: string;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const rawEndpoint = this.configService.get<string>(
      'MINIO_ENDPOINT',
      'localhost',
    );
    const parsed = this.parseEndpoint(rawEndpoint);
    const port =
      this.configService.get<number>('MINIO_PORT') ?? parsed.port ?? 9000;
    const useSSL =
      this.configService.get<string>('MINIO_USE_SSL') === 'true' || parsed.useSSL;
    const accessKey = this.configService.get<string>(
      'MINIO_ACCESS_KEY',
      'minioadmin',
    );
    const secretKey = this.configService.get<string>(
      'MINIO_SECRET_KEY',
      'minioadmin',
    );
    this.bucket = this.configService.get<string>('MINIO_BUCKET', 'wms-documents');

    this.client = new Minio.Client({
      endPoint: parsed.host,
      port,
      useSSL,
      accessKey,
      secretKey,
    });

    await this.ensureBucket();
  }

  /** Accepts host, host:port, or full URL like http://localhost:9000 */
  private parseEndpoint(value: string): {
    host: string;
    port?: number;
    useSSL: boolean;
  } {
    const trimmed = value.trim();
    if (trimmed.includes('://')) {
      const url = new URL(trimmed);
      return {
        host: url.hostname,
        port: url.port ? Number(url.port) : undefined,
        useSSL: url.protocol === 'https:',
      };
    }
    const [host, portStr] = trimmed.split(':');
    return {
      host: host || 'localhost',
      port: portStr ? Number(portStr) : undefined,
      useSSL: false,
    };
  }

  async upload(
    key: string,
    body: Buffer,
    options?: StorageUploadOptions,
  ): Promise<string> {
    const metaData: Record<string, string> = {
      ...(options?.metadata ?? {}),
    };

    if (options?.contentType) {
      metaData['Content-Type'] = options.contentType;
    }

    await this.client.putObject(this.bucket, key, body, body.length, metaData);
    return key;
  }

  async download(key: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, key);
    const chunks: Buffer[] = [];

    return new Promise<Buffer>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async delete(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucket, key, expiresInSeconds);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, key);
      return true;
    } catch {
      return false;
    }
  }

  private async ensureBucket(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket, 'us-east-1');
        this.logger.log(`Created MinIO bucket: ${this.bucket}`);
      }
    } catch (err: unknown) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code: unknown }).code)
          : '';
      // Concurrent create or already-owned is fine
      if (
        code === 'BucketAlreadyOwnedByYou' ||
        code === 'BucketAlreadyExists'
      ) {
        return;
      }
      throw err;
    }
  }
}
