import { DocumentType } from '@wms/types';

export type DocumentRelatedEntity = 'SHIPMENT' | 'INBOUND_RECEIPT';

export interface PortalDocumentDto {
  id: string;
  type: DocumentType;
  filename: string;
  relatedEntity: DocumentRelatedEntity;
  relatedId: string;
  createdAt: string;
  downloadUrl: string | null;
}

export function buildShipmentDocumentId(
  shipmentId: string,
  type: DocumentType,
): string {
  return `shipment:${shipmentId}:${type}`;
}

export function buildReceiptDocumentId(receiptId: string): string {
  return `receipt:${receiptId}:${DocumentType.ASN}`;
}

export function filenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segment = pathname.split('/').filter(Boolean).pop();
    return segment ?? 'document';
  } catch {
    const segment = url.split('/').filter(Boolean).pop();
    return segment ?? 'document';
  }
}
