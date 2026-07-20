import { HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import { DocumentType, ErrorCodes } from '@wms/types';
import { WmsException } from '../../common/exceptions/wms.exception';
import { createPaginationMeta } from '../../common/utils/pagination';
import {
  STORAGE_SERVICE,
  buildTenantStorageKey,
  type IStorageService,
} from '../../infrastructure/storage/storage.interface';
import { DocumentRepository } from './document.repository';
import {
  buildReceiptDocumentId,
  buildShipmentDocumentId,
  filenameFromUrl,
  type PortalDocumentDto,
} from './document.types';
import type { ListDocumentsQueryDto } from './dto/list-documents-query.dto';

@Injectable()
export class DocumentService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    @Optional() @Inject(STORAGE_SERVICE) private readonly storage?: IStorageService,
  ) {}

  async listDocuments(clientId: string, query: ListDocumentsQueryDto) {
    const includeLabel =
      !query.type || query.type === DocumentType.LABEL;
    const includePod = !query.type || query.type === DocumentType.POD;
    const includeAsn = !query.type || query.type === DocumentType.ASN;
    const includePacking =
      !query.type || query.type === DocumentType.PACKING_LIST;
    const includeInvoice =
      !query.type || query.type === DocumentType.INVOICE;

    const shipmentTypes: Array<DocumentType.LABEL | DocumentType.POD> = [];
    if (includeLabel || includePacking) {
      shipmentTypes.push(DocumentType.LABEL);
    }
    if (includePod || includeInvoice) {
      shipmentTypes.push(DocumentType.POD);
    }

    const [shipments, receipts] = await Promise.all([
      shipmentTypes.length > 0
        ? this.documentRepository.findShipmentDocuments(
            clientId,
            query,
            [...new Set(shipmentTypes)],
          )
        : Promise.resolve([]),
      includeAsn
        ? this.documentRepository.findAsnReceipts(clientId, query)
        : Promise.resolve([]),
    ]);

    const documents: PortalDocumentDto[] = [];

    for (const shipment of shipments) {
      if (includeLabel && shipment.labelUrl) {
        documents.push({
          id: buildShipmentDocumentId(shipment.id, DocumentType.LABEL),
          type: DocumentType.LABEL,
          filename: filenameFromUrl(shipment.labelUrl),
          relatedEntity: 'SHIPMENT',
          relatedId: shipment.id,
          createdAt: shipment.createdAt.toISOString(),
          downloadUrl: shipment.labelUrl,
        });
      }

      if (includePod && shipment.podUrl) {
        documents.push({
          id: buildShipmentDocumentId(shipment.id, DocumentType.POD),
          type: DocumentType.POD,
          filename: filenameFromUrl(shipment.podUrl),
          relatedEntity: 'SHIPMENT',
          relatedId: shipment.id,
          createdAt: shipment.createdAt.toISOString(),
          downloadUrl: shipment.podUrl,
        });
      }

      // Packing list / invoice reuse label URL when dedicated fields are absent
      if (includePacking && shipment.labelUrl) {
        documents.push({
          id: buildShipmentDocumentId(shipment.id, DocumentType.PACKING_LIST),
          type: DocumentType.PACKING_LIST,
          filename: `packing-list-${shipment.id.slice(0, 8)}.pdf`,
          relatedEntity: 'SHIPMENT',
          relatedId: shipment.id,
          createdAt: shipment.createdAt.toISOString(),
          downloadUrl: shipment.labelUrl,
        });
      }

      if (includeInvoice && shipment.podUrl) {
        documents.push({
          id: `shipment:${shipment.id}:${DocumentType.INVOICE}`,
          type: DocumentType.INVOICE,
          filename: `invoice-${shipment.id.slice(0, 8)}.pdf`,
          relatedEntity: 'SHIPMENT',
          relatedId: shipment.id,
          createdAt: shipment.createdAt.toISOString(),
          downloadUrl: shipment.podUrl,
        });
      }
    }

    for (const receipt of receipts) {
      if (!receipt.asnNumber) continue;

      documents.push({
        id: buildReceiptDocumentId(receipt.id),
        type: DocumentType.ASN,
        filename: `ASN-${receipt.asnNumber}.txt`,
        relatedEntity: 'INBOUND_RECEIPT',
        relatedId: receipt.id,
        createdAt: receipt.createdAt.toISOString(),
        downloadUrl: null,
      });
    }

    documents.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const start = (page - 1) * limit;
    const items = documents.slice(start, start + limit);

    return {
      items,
      meta: createPaginationMeta(
        page,
        limit,
        documents.length,
        query.sortBy,
        query.sortOrder,
      ),
    };
  }

  async getDownloadUrl(clientId: string, documentId: string): Promise<string> {
    const parsed = this.parseDocumentId(documentId);

    if (parsed.entity === 'SHIPMENT') {
      const shipment = await this.documentRepository.findShipmentById(
        clientId,
        parsed.relatedId,
      );

      if (!shipment) {
        throw new WmsException(
          ErrorCodes.SYS_NOT_FOUND,
          `Document with ID ${documentId} not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      const url =
        parsed.type === DocumentType.POD || parsed.type === DocumentType.INVOICE
          ? shipment.podUrl || shipment.labelUrl
          : shipment.labelUrl;

      if (!url) {
        throw new WmsException(
          ErrorCodes.SYS_NOT_FOUND,
          `Document with ID ${documentId} not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      return url;
    }

    const receipt = await this.documentRepository.findReceiptById(
      clientId,
      parsed.relatedId,
    );

    if (!receipt?.asnNumber) {
      throw new WmsException(
        ErrorCodes.SYS_NOT_FOUND,
        `Document with ID ${documentId} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    return this.ensureAsnDocument(clientId, receipt);
  }

  private async ensureAsnDocument(
    clientId: string,
    receipt: {
      id: string;
      asnNumber: string | null;
      expectedDate: Date | null;
      carrierName: string | null;
      status: string;
      lines?: Array<{
        expectedQty: { toString(): string };
        item?: { sku: string; description: string } | null;
      }>;
    },
  ): Promise<string> {
    const filename = `ASN-${receipt.asnNumber}.txt`;
    const key = buildTenantStorageKey(clientId, 'asn', filename);

    if (this.storage) {
      const exists = await this.storage.exists(key);
      if (exists) {
        return this.storage.getSignedUrl(key, 3600);
      }
    }

    const lines = (receipt.lines ?? [])
      .map(
        (l, i) =>
          `${i + 1}. ${l.item?.sku ?? 'SKU'} — qty ${l.expectedQty.toString()} (${l.item?.description ?? ''})`,
      )
      .join('\n');

    const body = Buffer.from(
      [
        `ADVANCE SHIPPING NOTICE`,
        `ASN: ${receipt.asnNumber}`,
        `Status: ${receipt.status}`,
        `Expected: ${receipt.expectedDate?.toISOString() ?? 'TBD'}`,
        `Carrier: ${receipt.carrierName ?? 'N/A'}`,
        ``,
        `Lines:`,
        lines || '(no lines)',
        ``,
        `Generated: ${new Date().toISOString()}`,
      ].join('\n'),
      'utf8',
    );

    if (!this.storage) {
      // Fallback data URL when object storage is unavailable
      return `data:text/plain;base64,${body.toString('base64')}`;
    }

    await this.storage.upload(key, body, { contentType: 'text/plain' });
    return this.storage.getSignedUrl(key, 3600);
  }

  private parseDocumentId(documentId: string): {
    entity: 'SHIPMENT' | 'INBOUND_RECEIPT';
    relatedId: string;
    type: DocumentType;
  } {
    const parts = documentId.split(':');

    if (parts.length !== 3) {
      throw new WmsException(
        ErrorCodes.VAL_VALIDATION_FAILED,
        `Invalid document ID ${documentId}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const [entityPrefix, relatedId, type] = parts;

    if (entityPrefix === 'shipment') {
      return {
        entity: 'SHIPMENT',
        relatedId,
        type: type as DocumentType,
      };
    }

    if (entityPrefix === 'receipt' && type === DocumentType.ASN) {
      return {
        entity: 'INBOUND_RECEIPT',
        relatedId,
        type: DocumentType.ASN,
      };
    }

    throw new WmsException(
      ErrorCodes.VAL_VALIDATION_FAILED,
      `Invalid document ID ${documentId}`,
      HttpStatus.BAD_REQUEST,
    );
  }
}
