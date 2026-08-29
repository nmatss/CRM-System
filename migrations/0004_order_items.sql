-- Migration 0004: transactional order line items and integer monetary snapshots
-- Additive SQLite migration. Apply once through the controlled migration process.

BEGIN IMMEDIATE;

ALTER TABLE orders
  ADD COLUMN total_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_cents >= 0);

UPDATE orders
SET total_cents = CAST(ROUND(total * 100) AS INTEGER);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  line_total_cents INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  CONSTRAINT order_items_line_total_cents_check
    CHECK (line_total_cents = unit_price_cents * quantity)
);

CREATE INDEX order_items_tenant_id_idx ON order_items(tenant_id);
CREATE INDEX order_items_order_id_idx ON order_items(order_id);
CREATE INDEX order_items_product_id_idx ON order_items(product_id);
CREATE UNIQUE INDEX order_items_tenant_order_product_unique
  ON order_items(tenant_id, order_id, product_id);

-- Enforce tenant ownership even for writes outside the application storage layer.
CREATE TRIGGER order_items_tenant_guard_insert
BEFORE INSERT ON order_items
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM orders WHERE id = NEW.order_id AND tenant_id = NEW.tenant_id
  ) THEN RAISE(ABORT, 'order_items order tenant mismatch') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM products WHERE id = NEW.product_id AND tenant_id = NEW.tenant_id
  ) THEN RAISE(ABORT, 'order_items product tenant mismatch') END;
END;

CREATE TRIGGER order_items_tenant_guard_update
BEFORE UPDATE OF tenant_id, order_id, product_id ON order_items
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM orders WHERE id = NEW.order_id AND tenant_id = NEW.tenant_id
  ) THEN RAISE(ABORT, 'order_items order tenant mismatch') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM products WHERE id = NEW.product_id AND tenant_id = NEW.tenant_id
  ) THEN RAISE(ABORT, 'order_items product tenant mismatch') END;
END;

INSERT OR IGNORE INTO schema_migrations (version, description)
VALUES ('0004', 'Transactional order items and integer monetary snapshots');

COMMIT;
