import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OpsRole } from '@wms/types';
import {
  createInvoiceSchema,
  createManualChargeSchema,
  listChargesQuerySchema,
  listInvoicesQuerySchema,
  meterBillingSchema,
  upsertRateCardSchema,
} from '@wms/zod-schemas';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequiresFeature } from '../../common/decorators/requires-feature.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { FeatureGuard } from '../../license/feature.guard';
import { WmsException } from '../../common/exceptions/wms.exception';
import { ErrorCodes } from '@wms/types';
import { BillingService } from './billing.service';

@UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
@Controller()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // ── Ops billing ──────────────────────────────────────────────────────────

  @Get('billing/summary')
  @RequiresFeature('billing')
  @Roles(OpsRole.ADMIN, OpsRole.BILLING, OpsRole.SUPERVISOR, OpsRole.READONLY)
  summary() {
    return this.billingService.listChargeSummaries();
  }

  /** Legacy summary list used by ops dashboard (array of client rows). */
  @Get('billing/charges')
  @RequiresFeature('billing')
  @Roles(OpsRole.ADMIN, OpsRole.BILLING, OpsRole.SUPERVISOR, OpsRole.READONLY)
  chargesLegacy() {
    return this.billingService.listChargeSummaries();
  }

  @Get('billing/charges/list')
  @RequiresFeature('billing')
  @Roles(OpsRole.ADMIN, OpsRole.BILLING, OpsRole.SUPERVISOR, OpsRole.READONLY)
  listCharges(
    @Query(new ZodValidationPipe(listChargesQuerySchema)) query: {
      clientId?: string;
      status?: 'DRAFT' | 'INVOICED' | 'VOID';
      page: number;
      limit: number;
    },
  ) {
    return this.billingService.listCharges(query);
  }

  @Get('billing/invoices')
  @RequiresFeature('billing')
  @Roles(OpsRole.ADMIN, OpsRole.BILLING, OpsRole.SUPERVISOR, OpsRole.READONLY)
  listInvoices(
    @Query(new ZodValidationPipe(listInvoicesQuerySchema)) query: {
      clientId?: string;
      status?: 'DRAFT' | 'ISSUED' | 'PAID' | 'VOID';
      page: number;
      limit: number;
    },
  ) {
    return this.billingService.listInvoices(query);
  }

  @Get('billing/invoices/:id')
  @RequiresFeature('billing')
  @Roles(OpsRole.ADMIN, OpsRole.BILLING, OpsRole.SUPERVISOR, OpsRole.READONLY)
  getInvoice(@Param('id') id: string) {
    return this.billingService.getInvoice(id);
  }

  @Get('billing/clients/:clientId/rate-card')
  @RequiresFeature('billing')
  @Roles(OpsRole.ADMIN, OpsRole.BILLING, OpsRole.SUPERVISOR, OpsRole.READONLY)
  getRateCard(@Param('clientId') clientId: string) {
    return this.billingService.getRateCard(clientId);
  }

  @Put('billing/clients/:clientId/rate-card')
  @RequiresFeature('billing')
  @Roles(OpsRole.ADMIN, OpsRole.BILLING, OpsRole.SUPERVISOR)
  upsertRateCard(
    @Param('clientId') clientId: string,
    @Body(new ZodValidationPipe(upsertRateCardSchema)) body: unknown,
  ) {
    return this.billingService.upsertRateCard(
      clientId,
      body as Parameters<BillingService['upsertRateCard']>[1],
    );
  }

  @Post('billing/meter')
  @RequiresFeature('billing')
  @Roles(OpsRole.ADMIN, OpsRole.BILLING, OpsRole.SUPERVISOR)
  meter(@Body(new ZodValidationPipe(meterBillingSchema)) body: unknown) {
    return this.billingService.meterPeriod(
      body as Parameters<BillingService['meterPeriod']>[0],
    );
  }

  @Post('billing/charges/manual')
  @RequiresFeature('billing')
  @Roles(OpsRole.ADMIN, OpsRole.BILLING, OpsRole.SUPERVISOR)
  manualCharge(
    @Body(new ZodValidationPipe(createManualChargeSchema)) body: unknown,
  ) {
    return this.billingService.createManualCharge(
      body as Parameters<BillingService['createManualCharge']>[0],
    );
  }

  @Post('billing/invoices')
  @RequiresFeature('billing')
  @Roles(OpsRole.ADMIN, OpsRole.BILLING, OpsRole.SUPERVISOR)
  createInvoice(
    @Body(new ZodValidationPipe(createInvoiceSchema)) body: unknown,
  ) {
    return this.billingService.createInvoice(
      body as Parameters<BillingService['createInvoice']>[0],
    );
  }

  @Post('billing/invoices/:id/issue')
  @RequiresFeature('billing')
  @Roles(OpsRole.ADMIN, OpsRole.BILLING, OpsRole.SUPERVISOR)
  issueInvoice(@Param('id') id: string) {
    return this.billingService.issueInvoice(id);
  }

  @Get('billing/vas')
  @RequiresFeature('vas')
  @Roles(OpsRole.ADMIN, OpsRole.BILLING, OpsRole.SUPERVISOR, OpsRole.READONLY)
  vas() {
    return this.billingService.listVasCatalog();
  }

  @Get('billing/rma')
  @RequiresFeature('rma')
  @Roles(OpsRole.ADMIN, OpsRole.SUPERVISOR, OpsRole.WAREHOUSE_OPS, OpsRole.READONLY)
  rma() {
    return this.billingService.listRmaPlaceholders();
  }

  @Get('billing/edi/partners')
  @RequiresFeature('edi')
  @Roles(OpsRole.ADMIN, OpsRole.SUPERVISOR, OpsRole.READONLY)
  edi() {
    return this.billingService.listEdiPartners();
  }

  // ── Portal invoices ──────────────────────────────────────────────────────

  @Get('portal/invoices')
  @RequiresFeature('billing')
  async portalInvoices(
    @TenantId() clientId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!clientId) {
      throw new WmsException(
        ErrorCodes.AUTH_FORBIDDEN,
        'Client ID not found in request context',
        HttpStatus.FORBIDDEN,
      );
    }
    return this.billingService.listPortalInvoices(
      clientId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 50,
    );
  }

  @Get('portal/invoices/:id')
  @RequiresFeature('billing')
  async portalInvoice(
    @TenantId() clientId: string,
    @Param('id') id: string,
  ) {
    if (!clientId) {
      throw new WmsException(
        ErrorCodes.AUTH_FORBIDDEN,
        'Client ID not found in request context',
        HttpStatus.FORBIDDEN,
      );
    }
    return this.billingService.getPortalInvoice(clientId, id);
  }
}
