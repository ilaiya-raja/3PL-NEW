import { Injectable, NotImplementedException } from '@nestjs/common';
import type { IStorageService, StorageUploadOptions } from './storage.interface';

@Injectable()
export class S3StorageService implements IStorageService {
  upload(
    _key: string,
    _body: Buffer,
    _options?: StorageUploadOptions,
  ): Promise<string> {
    throw new NotImplementedException('S3 storage provider is not implemented');
  }

  download(_key: string): Promise<Buffer> {
    throw new NotImplementedException('S3 storage provider is not implemented');
  }

  delete(_key: string): Promise<void> {
    throw new NotImplementedException('S3 storage provider is not implemented');
  }

  getSignedUrl(_key: string, _expiresInSeconds?: number): Promise<string> {
    throw new NotImplementedException('S3 storage provider is not implemented');
  }

  exists(_key: string): Promise<boolean> {
    throw new NotImplementedException('S3 storage provider is not implemented');
  }
}
