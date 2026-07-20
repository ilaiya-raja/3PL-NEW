export interface StorageUploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface IStorageService {
  upload(
    key: string,
    body: Buffer,
    options?: StorageUploadOptions,
  ): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  exists(key: string): Promise<boolean>;
}

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');

export function buildTenantStorageKey(
  clientId: string,
  docType: string,
  filename: string,
): string {
  const sanitizedFilename = filename.replace(/[/\\]/g, '_');
  return `clients/${clientId}/${docType}/${sanitizedFilename}`;
}
