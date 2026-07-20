-- Performance indexes

CREATE INDEX IF NOT EXISTS inventory_lot_available_fefo_idx
  ON inventory_lot (client_id, item_id, expiry_date)
  WHERE status = 'AVAILABLE';

CREATE INDEX IF NOT EXISTS outbound_order_client_status_sla_idx
  ON outbound_order (client_id, status, sla_ship_by);

CREATE INDEX IF NOT EXISTS pick_task_status_sequence_idx
  ON pick_task (status, pick_sequence);
