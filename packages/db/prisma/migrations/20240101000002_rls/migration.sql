-- Row-Level Security policies for all tenant tables.
-- Isolation: client_id must match session setting OR actor_role = warehouse_ops.

DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'contract',
    'sla_definition',
    'portal_user',
    'item',
    'inventory_lot',
    'inventory_transaction',
    'inventory_hold',
    'adjustment',
    'inbound_receipt',
    'inbound_line',
    'outbound_order',
    'outbound_line',
    'allocation',
    'carton',
    'carton_line',
    'shipment',
    'pick_task'
  ];
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

-- Client table uses id as the tenant key (no client_id column)
ALTER TABLE client ENABLE ROW LEVEL SECURITY;
ALTER TABLE client FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON client;
CREATE POLICY tenant_isolation ON client
  USING (
    id = NULLIF(current_setting('app.client_id', true), '')::uuid
    OR current_setting('app.actor_role', true) = 'warehouse_ops'
  )
  WITH CHECK (
    current_setting('app.actor_role', true) = 'warehouse_ops'
  );
