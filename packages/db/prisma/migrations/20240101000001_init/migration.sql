-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('PROSPECT', 'ONBOARDING', 'ACTIVE', 'SUSPENDED', 'OFFBOARDED');

-- CreateEnum
CREATE TYPE "ZoneType" AS ENUM ('RECEIVING', 'RESERVE', 'PICK', 'PACK', 'STAGING', 'QUARANTINE', 'RETURNS', 'YARD');

-- CreateEnum
CREATE TYPE "TempClass" AS ENUM ('AMBIENT', 'CHILLED', 'FROZEN');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('PICK_FACE', 'RESERVE', 'STAGING', 'DOCK', 'YARD', 'VIRTUAL');

-- CreateEnum
CREATE TYPE "LotStatus" AS ENUM ('RECEIVED', 'AVAILABLE', 'PICKED', 'ON_HOLD', 'QC_HOLD', 'QUARANTINE', 'DAMAGED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TxnType" AS ENUM ('RECEIPT', 'PUTAWAY', 'PICK', 'PACK', 'SHIP', 'ADJUST', 'TRANSFER_OUT', 'TRANSFER_IN', 'HOLD', 'RELEASE', 'COUNT', 'RETURN', 'ALLOCATE', 'DEALLOCATE');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('EXPECTED', 'ARRIVED', 'RECEIVING', 'QC', 'COMPLETE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('RECEIVED', 'VALIDATED', 'ALLOCATED', 'RELEASED', 'PICKING', 'PACKED', 'SHIPPED', 'CANCELLED', 'BACKORDERED');

-- CreateEnum
CREATE TYPE "WaveStatus" AS ENUM ('PLANNING', 'RELEASED', 'COMPLETE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CartonStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ShipStatus" AS ENUM ('CREATED', 'MANIFESTED', 'IN_TRANSIT', 'DELIVERED', 'EXCEPTION', 'RTO');

-- CreateEnum
CREATE TYPE "OpsRole" AS ENUM ('ADMIN', 'SUPERVISOR', 'WAREHOUSE_OPS', 'BILLING', 'READONLY');

-- CreateEnum
CREATE TYPE "PortalRole" AS ENUM ('CLIENT_ADMIN', 'ORDER_ENTRY', 'VIEWER');

-- CreateEnum
CREATE TYPE "AdjustmentStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "HoldType" AS ENUM ('CLIENT_HOLD', 'QC_HOLD', 'RECALL_HOLD', 'LEGAL_HOLD');

-- CreateEnum
CREATE TYPE "PickTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETE', 'SHORT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CHECKED_IN', 'CHECKED_OUT', 'NO_SHOW', 'CANCELLED');

-- CreateTable
CREATE TABLE "license" (
    "id" UUID NOT NULL,
    "license_key" TEXT NOT NULL,
    "activated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activated_by" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "license_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_user" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "OpsRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ops_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zone" (
    "id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ZoneType" NOT NULL,
    "temp_class" "TempClass" NOT NULL DEFAULT 'AMBIENT',
    "hazmat_allowed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location" (
    "id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "type" "LocationType" NOT NULL,
    "client_id" UUID,
    "pick_sequence" INTEGER,
    "max_weight_kg" DECIMAL(14,3),
    "dims" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wave" (
    "id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "WaveStatus" NOT NULL DEFAULT 'PLANNING',
    "released_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dock_appointment" (
    "id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "receipt_id" UUID,
    "dock_code" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "carrier_name" TEXT,
    "vehicle_ref" TEXT,
    "driver_name" TEXT,
    "driver_phone" TEXT,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "checked_in_at" TIMESTAMP(3),
    "checked_out_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dock_appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "gstin" TEXT,
    "status" "ClientStatus" NOT NULL DEFAULT 'ONBOARDING',
    "config" JSONB NOT NULL DEFAULT '{}',
    "branding" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "min_monthly_commit" DECIMAL(14,4),
    "renewal_alert_days" INTEGER NOT NULL DEFAULT 30,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_definition" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "metric" TEXT NOT NULL,
    "target_value" DECIMAL(14,3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_user" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "PortalRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "uom" TEXT NOT NULL DEFAULT 'EA',
    "pack_config" JSONB NOT NULL DEFAULT '{}',
    "lot_tracked" BOOLEAN NOT NULL DEFAULT false,
    "serial_tracked" BOOLEAN NOT NULL DEFAULT false,
    "shelf_life_days" INTEGER,
    "min_ship_shelf_pct" DECIMAL(5,2),
    "hazmat_class" TEXT,
    "temp_class" "TempClass" NOT NULL DEFAULT 'AMBIENT',
    "velocity_class" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_lot" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "location_id" UUID,
    "lpn" TEXT,
    "lot_number" TEXT,
    "expiry_date" DATE,
    "qty_on_hand" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "qty_allocated" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "status" "LotStatus" NOT NULL DEFAULT 'RECEIVED',
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receipt_line_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transaction" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "txn_type" "TxnType" NOT NULL,
    "item_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "from_location_id" UUID,
    "to_location_id" UUID,
    "qty_delta" DECIMAL(14,3) NOT NULL,
    "status_from" "LotStatus",
    "status_to" "LotStatus",
    "ref_type" TEXT,
    "ref_id" UUID,
    "actor_id" UUID,
    "notes" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_hold" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "item_id" UUID,
    "lot_id" UUID,
    "location_id" UUID,
    "hold_type" "HoldType" NOT NULL,
    "reason" TEXT NOT NULL,
    "held_by" UUID NOT NULL,
    "released_by" UUID,
    "released_at" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_hold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adjustment" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "location_id" UUID,
    "qty_delta" DECIMAL(14,3) NOT NULL,
    "reason_code" TEXT NOT NULL,
    "notes" TEXT,
    "status" "AdjustmentStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "requested_by" UUID NOT NULL,
    "approved_by" UUID,
    "rejected_by" UUID,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_receipt" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "asn_number" TEXT,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'EXPECTED',
    "expected_date" DATE,
    "arrived_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "carrier_name" TEXT,
    "vehicle_ref" TEXT,
    "seal_number" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbound_receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_line" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "expected_qty" DECIMAL(14,3) NOT NULL,
    "received_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "damaged_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "short_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "lot_number" TEXT,
    "expiry_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbound_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_order" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "external_ref" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'RECEIVED',
    "ship_to" JSONB NOT NULL,
    "bill_to" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "sla_ship_by" TIMESTAMP(3),
    "wave_id" UUID,
    "notes" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_line" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "ordered_qty" DECIMAL(14,3) NOT NULL,
    "picked_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "packed_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "backordered_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "requested_lot_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocation" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "line_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "allocated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pick_task" (
    "id" UUID NOT NULL,
    "wave_id" UUID,
    "order_id" UUID NOT NULL,
    "line_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "from_location_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "qty_to_pick" DECIMAL(14,3) NOT NULL,
    "qty_picked" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "status" "PickTaskStatus" NOT NULL DEFAULT 'OPEN',
    "pick_sequence" INTEGER NOT NULL,
    "assigned_to" UUID,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pick_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carton" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "carton_no" TEXT NOT NULL,
    "dims" JSONB,
    "weight_kg" DECIMAL(14,3),
    "label_url" TEXT,
    "status" "CartonStatus" NOT NULL DEFAULT 'OPEN',
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carton_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carton_line" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "carton_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carton_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "carrier_name" TEXT,
    "tracking_number" TEXT,
    "label_url" TEXT,
    "pod_url" TEXT,
    "ship_date" TIMESTAMP(3),
    "status" "ShipStatus" NOT NULL DEFAULT 'CREATED',
    "eway_bill_no" TEXT,
    "manifested_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ops_user_email_key" ON "ops_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_code_key" ON "warehouse"("code");

-- CreateIndex
CREATE UNIQUE INDEX "zone_warehouse_id_code_key" ON "zone"("warehouse_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "location_code_key" ON "location"("code");

-- CreateIndex
CREATE INDEX "location_warehouse_id_idx" ON "location"("warehouse_id");

-- CreateIndex
CREATE INDEX "location_client_id_idx" ON "location"("client_id");

-- CreateIndex
CREATE INDEX "wave_warehouse_id_status_idx" ON "wave"("warehouse_id", "status");

-- CreateIndex
CREATE INDEX "dock_appointment_warehouse_id_scheduled_at_idx" ON "dock_appointment"("warehouse_id", "scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "client_code_key" ON "client"("code");

-- CreateIndex
CREATE INDEX "contract_client_id_idx" ON "contract"("client_id");

-- CreateIndex
CREATE INDEX "sla_definition_contract_id_idx" ON "sla_definition"("contract_id");

-- CreateIndex
CREATE INDEX "sla_definition_client_id_idx" ON "sla_definition"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "portal_user_email_key" ON "portal_user"("email");

-- CreateIndex
CREATE INDEX "portal_user_client_id_idx" ON "portal_user"("client_id");

-- CreateIndex
CREATE INDEX "item_client_id_idx" ON "item"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_client_id_sku_key" ON "item"("client_id", "sku");

-- CreateIndex
CREATE INDEX "inventory_lot_client_id_item_id_status_expiry_date_idx" ON "inventory_lot"("client_id", "item_id", "status", "expiry_date");

-- CreateIndex
CREATE INDEX "inventory_lot_client_id_status_idx" ON "inventory_lot"("client_id", "status");

-- CreateIndex
CREATE INDEX "inventory_lot_lpn_idx" ON "inventory_lot"("lpn");

-- CreateIndex
CREATE INDEX "inventory_transaction_client_id_occurred_at_idx" ON "inventory_transaction"("client_id", "occurred_at");

-- CreateIndex
CREATE INDEX "inventory_transaction_lot_id_idx" ON "inventory_transaction"("lot_id");

-- CreateIndex
CREATE INDEX "inventory_transaction_ref_type_ref_id_idx" ON "inventory_transaction"("ref_type", "ref_id");

-- CreateIndex
CREATE INDEX "inventory_hold_client_id_active_idx" ON "inventory_hold"("client_id", "active");

-- CreateIndex
CREATE INDEX "adjustment_client_id_status_idx" ON "adjustment"("client_id", "status");

-- CreateIndex
CREATE INDEX "inbound_receipt_client_id_status_idx" ON "inbound_receipt"("client_id", "status");

-- CreateIndex
CREATE INDEX "inbound_line_receipt_id_idx" ON "inbound_line"("receipt_id");

-- CreateIndex
CREATE INDEX "inbound_line_client_id_idx" ON "inbound_line"("client_id");

-- CreateIndex
CREATE INDEX "outbound_order_client_id_status_sla_ship_by_idx" ON "outbound_order"("client_id", "status", "sla_ship_by");

-- CreateIndex
CREATE UNIQUE INDEX "outbound_order_client_id_external_ref_key" ON "outbound_order"("client_id", "external_ref");

-- CreateIndex
CREATE INDEX "outbound_line_order_id_idx" ON "outbound_line"("order_id");

-- CreateIndex
CREATE INDEX "outbound_line_client_id_idx" ON "outbound_line"("client_id");

-- CreateIndex
CREATE INDEX "allocation_client_id_idx" ON "allocation"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "allocation_line_id_lot_id_key" ON "allocation"("line_id", "lot_id");

-- CreateIndex
CREATE INDEX "pick_task_status_pick_sequence_idx" ON "pick_task"("status", "pick_sequence");

-- CreateIndex
CREATE INDEX "pick_task_client_id_idx" ON "pick_task"("client_id");

-- CreateIndex
CREATE INDEX "carton_client_id_idx" ON "carton"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "carton_order_id_carton_no_key" ON "carton"("order_id", "carton_no");

-- CreateIndex
CREATE INDEX "carton_line_client_id_idx" ON "carton_line"("client_id");

-- CreateIndex
CREATE INDEX "shipment_client_id_idx" ON "shipment"("client_id");

-- CreateIndex
CREATE INDEX "shipment_order_id_idx" ON "shipment"("order_id");

-- AddForeignKey
ALTER TABLE "zone" ADD CONSTRAINT "zone_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location" ADD CONSTRAINT "location_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location" ADD CONSTRAINT "location_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location" ADD CONSTRAINT "location_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wave" ADD CONSTRAINT "wave_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dock_appointment" ADD CONSTRAINT "dock_appointment_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dock_appointment" ADD CONSTRAINT "dock_appointment_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "inbound_receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_definition" ADD CONSTRAINT "sla_definition_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_user" ADD CONSTRAINT "portal_user_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item" ADD CONSTRAINT "item_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_lot" ADD CONSTRAINT "inventory_lot_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_lot" ADD CONSTRAINT "inventory_lot_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_lot" ADD CONSTRAINT "inventory_lot_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_lot" ADD CONSTRAINT "inventory_lot_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transaction" ADD CONSTRAINT "inventory_transaction_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transaction" ADD CONSTRAINT "inventory_transaction_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transaction" ADD CONSTRAINT "inventory_transaction_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "inventory_lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_hold" ADD CONSTRAINT "inventory_hold_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_hold" ADD CONSTRAINT "inventory_hold_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_hold" ADD CONSTRAINT "inventory_hold_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "inventory_lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_hold" ADD CONSTRAINT "inventory_hold_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment" ADD CONSTRAINT "adjustment_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment" ADD CONSTRAINT "adjustment_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustment" ADD CONSTRAINT "adjustment_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "inventory_lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_receipt" ADD CONSTRAINT "inbound_receipt_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_receipt" ADD CONSTRAINT "inbound_receipt_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_line" ADD CONSTRAINT "inbound_line_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "inbound_receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_line" ADD CONSTRAINT "inbound_line_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_order" ADD CONSTRAINT "outbound_order_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_order" ADD CONSTRAINT "outbound_order_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_order" ADD CONSTRAINT "outbound_order_wave_id_fkey" FOREIGN KEY ("wave_id") REFERENCES "wave"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_line" ADD CONSTRAINT "outbound_line_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "outbound_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_line" ADD CONSTRAINT "outbound_line_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation" ADD CONSTRAINT "allocation_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "outbound_line"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation" ADD CONSTRAINT "allocation_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "inventory_lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pick_task" ADD CONSTRAINT "pick_task_wave_id_fkey" FOREIGN KEY ("wave_id") REFERENCES "wave"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pick_task" ADD CONSTRAINT "pick_task_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "outbound_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pick_task" ADD CONSTRAINT "pick_task_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "outbound_line"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pick_task" ADD CONSTRAINT "pick_task_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "inventory_lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pick_task" ADD CONSTRAINT "pick_task_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pick_task" ADD CONSTRAINT "pick_task_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carton" ADD CONSTRAINT "carton_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "outbound_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carton" ADD CONSTRAINT "carton_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carton_line" ADD CONSTRAINT "carton_line_carton_id_fkey" FOREIGN KEY ("carton_id") REFERENCES "carton"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carton_line" ADD CONSTRAINT "carton_line_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carton_line" ADD CONSTRAINT "carton_line_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "inventory_lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "outbound_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

