import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { WmsException } from '../../common/exceptions/wms.exception';
import { ErrorCodes } from '@wms/types';
import { DocumentService } from './document.service';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';

@ApiTags('portal-documents')
@ApiBearerAuth()
@Controller()
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Get('portal/documents')
  @ApiOperation({ summary: 'List portal documents aggregated from shipments and receipts' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Documents retrieved' })
  async listDocuments(
    @TenantId() clientId: string,
    @Query() query: ListDocumentsQueryDto,
  ) {
    if (!clientId) {
      throw new WmsException(
        ErrorCodes.AUTH_FORBIDDEN,
        'Client ID not found in request context',
        HttpStatus.FORBIDDEN,
      );
    }

    return this.documentService.listDocuments(clientId, query);
  }

  @Get('portal/documents/:id/download')
  @ApiOperation({ summary: 'Get document download URL (JSON for SPA, redirect optional)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Download URL returned' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Document not found' })
  async downloadDocument(
    @TenantId() clientId: string,
    @Param('id') documentId: string,
    @Query('redirect') redirect: string | undefined,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    if (!clientId) {
      throw new WmsException(
        ErrorCodes.AUTH_FORBIDDEN,
        'Client ID not found in request context',
        HttpStatus.FORBIDDEN,
      );
    }

    const downloadUrl = await this.documentService.getDownloadUrl(
      clientId,
      decodeURIComponent(documentId),
    );

    if (redirect === '1' && !downloadUrl.startsWith('data:')) {
      return reply.redirect(downloadUrl, 302);
    }

    return { downloadUrl, url: downloadUrl };
  }
}
