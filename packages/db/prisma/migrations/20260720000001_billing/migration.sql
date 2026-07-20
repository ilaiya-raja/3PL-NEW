-- Billing enums
CREATE TYPE "ChargeType" AS ENUM ('STORAGE', 'PICK', 'PACK', 'SHIP', 'VAS', 'COMMIT_TOPUP');
CREATE TYPE "ChargeStatus" AS ENUM ('DRAFT', 'INVOICED', 'VOID');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'VOID');

-- Rate card (one per client)
CREATE TABLE "rate_card" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "storage_per_unit_day" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "pick_per_unit" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "pack_per_order" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "ship_per_shipment" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "vas_rates" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_card_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rate_card_client_id_key" ON "rate_card"("client_id");
ALTER TABLE "rate_card" ADD CONSTRAINT "rate_card_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Charges
CREATE TABLE "charge" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "charge_type" "ChargeType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit_rate" DECIMAL(14,4) NOT NULL,
    "amount" DECIMAL(14,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "source_ref" TEXT NOT NULL,
    "status" "ChargeStatus" NOT NULL DEFAULT 'DRAFT',
    "meta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "charge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "charge_client_id_charge_type_source_ref_key" ON "charge"("client_id", "charge_type", "source_ref");
CREATE INDEX "charge_client_id_status_period_start_idx" ON "charge"("client_id", "status", "period_start");
CREATE INDEX "charge_client_id_charge_type_idx" ON "charge"("client_id", "charge_type");
ALTER TABLE "charge" ADD CONSTRAINT "charge_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invoices
CREATE TABLE "invoice" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "invoice_no" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "subtotal" DECIMAL(14,4) NOT NULL,
    "tax_amount" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,4) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issued_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invoice_client_id_invoice_no_key" ON "invoice"("client_id", "invoice_no");
CREATE INDEX "invoice_client_id_status_idx" ON "invoice"("client_id", "status");
CREATE INDEX "invoice_client_id_period_start_idx" ON "invoice"("client_id", "period_start");
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invoice lines
CREATE TABLE "invoice_line" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "charge_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_line_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invoice_line_invoice_id_charge_id_key" ON "invoice_line"("invoice_id", "charge_id");
CREATE INDEX "invoice_line_client_id_idx" ON "invoice_line"("client_id");
CREATE INDEX "invoice_line_charge_id_idx" ON "invoice_line"("charge_id");
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "charge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS for billing tenant tables
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY['rate_card', 'charge', 'invoice', 'invoice_line'];
BEGIN
  FOREACH t IN ARRAY tenant_tables
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
       USING (
         client_id = NULLIF(current_setting(''app.client_id'', true), '''')::uuid
         OR current_setting(''app.actor_role'', true) = ''warehouse_ops''
       )
       WITH CHECK (
         client_id = NULLIF(current_setting(''app.client_id'', true), '''')::uuid
         OR current_setting(''app.actor_role'', true) = ''warehouse_ops''
       )',
      t
    );
  END LOOP;
END $$;
