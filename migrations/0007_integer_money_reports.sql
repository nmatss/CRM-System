-- Migration 0007: authoritative integer catalog money and historical report snapshots.
-- Additive dual-schema transition; legacy REAL columns remain readable and writable.
BEGIN IMMEDIATE;

ALTER TABLE products
  ADD COLUMN price_cents INTEGER NOT NULL DEFAULT 0 CHECK(price_cents >= 0);
UPDATE products SET price_cents=CAST(ROUND(price * 100) AS INTEGER);

ALTER TABLE customers
  ADD COLUMN ltv_cents INTEGER NOT NULL DEFAULT 0 CHECK(ltv_cents >= 0);
UPDATE customers SET ltv_cents=CAST(ROUND(ltv * 100) AS INTEGER);

ALTER TABLE order_items
  ADD COLUMN category_snapshot TEXT NOT NULL DEFAULT 'Outros';
UPDATE order_items
SET category_snapshot=COALESCE(
  (SELECT NULLIF(TRIM(products.category), '') FROM products WHERE products.id=order_items.product_id),
  'Outros'
);

-- A rolled-back application that still writes only legacy decimals continues to
-- maintain the integer projection. The current application dual-writes matching values.
CREATE TRIGGER products_price_cents_legacy_insert
AFTER INSERT ON products
WHEN NEW.price_cents != CAST(ROUND(NEW.price * 100) AS INTEGER)
BEGIN
  UPDATE products SET price_cents=CAST(ROUND(NEW.price * 100) AS INTEGER) WHERE id=NEW.id;
END;
CREATE TRIGGER products_price_cents_legacy_update
AFTER UPDATE OF price ON products
WHEN NEW.price_cents != CAST(ROUND(NEW.price * 100) AS INTEGER)
BEGIN
  UPDATE products SET price_cents=CAST(ROUND(NEW.price * 100) AS INTEGER) WHERE id=NEW.id;
END;
CREATE TRIGGER customers_ltv_cents_legacy_insert
AFTER INSERT ON customers
WHEN NEW.ltv_cents != CAST(ROUND(NEW.ltv * 100) AS INTEGER)
BEGIN
  UPDATE customers SET ltv_cents=CAST(ROUND(NEW.ltv * 100) AS INTEGER) WHERE id=NEW.id;
END;
CREATE TRIGGER customers_ltv_cents_legacy_update
AFTER UPDATE OF ltv ON customers
WHEN NEW.ltv_cents != CAST(ROUND(NEW.ltv * 100) AS INTEGER)
BEGIN
  UPDATE customers SET ltv_cents=CAST(ROUND(NEW.ltv * 100) AS INTEGER) WHERE id=NEW.id;
END;

CREATE TRIGGER order_items_category_snapshot_immutable
BEFORE UPDATE OF category_snapshot ON order_items
WHEN NEW.category_snapshot != OLD.category_snapshot
BEGIN
  SELECT RAISE(ABORT, 'order item category snapshot is immutable');
END;

CREATE INDEX order_items_tenant_category_idx
  ON order_items(tenant_id, category_snapshot);

INSERT OR IGNORE INTO schema_migrations(version, description)
VALUES('0007', 'Integer catalog money and historical report category snapshots');

COMMIT;
