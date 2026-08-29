# Database Migrations

This directory contains SQL migration files for the ZippiCRM database.

## Migration Files

### 0001_schema_optimization.sql

Initial schema optimization migration (PostgreSQL/Supabase specific). This migration was created during the transition from the initial schema and includes:

- Index additions for performance
- Data type conversions
- Audit field additions
- Constraint improvements

### 0002_add_constraints.sql

Legacy SQLite table-rebuild migration for CHECK constraints. This file contains `DROP TABLE` statements and must not be executed directly against any database with real data.

#### Products Table

- `price >= 0` - Product prices cannot be negative
- `stock >= 0` - Stock quantities cannot be negative

#### Orders Table

- `total >= 0` - Order totals cannot be negative

#### Customers Table

- `ltv >= 0` - Customer lifetime value cannot be negative

#### Campaigns Table

- `open_rate >= 0 AND open_rate <= 100` - Open rates must be between 0 and 100%
- `conversion >= 0 AND conversion <= 100` - Conversion rates must be between 0 and 100%

### 0004_order_items.sql

Additive SQLite migration for transactional order creation:

- Adds `orders.total_cents` as the integer source of truth for new orders.
- Creates immutable `order_items` price snapshots in integer cents.
- Enforces positive quantities, exact line totals, foreign keys, tenant guards and lookup indexes.
- Existing orders remain readable after backfill; all new API creations require transactional `lineItems`.

The runtime bootstrap applies the same additive objects when opening an older database. Validate the migration
against a disposable copy and retain the verified backup as the rollback mechanism. Do not reverse it by
dropping columns or tables in place.

### 0005_cashback_ledger.sql

Additive dual-contract migration for cashback. It backfills legacy decimal values into integer cents,
creates tenant/customer accounts, FIFO credit lots and debit allocations, and adds idempotency/reversal
metadata to the existing transaction table. Legacy decimal columns remain populated during the transition.
Rollback is restoration of the verified pre-migration backup; do not drop ledger objects in place.

### 0006_normalized_email_audit_events.sql

Adds a structural unique index on `LOWER(TRIM(users.email))` and an immutable `audit_events` stream.
The preflight aborts on legacy normalized collisions without merging, deleting or rewriting users. Resolve
collisions through an explicitly reviewed data-remediation procedure before retrying. Audit tenant/actor IDs
are retained snapshots rather than foreign keys, so deleting an identity cannot mutate or erase its history.
`BEFORE UPDATE/DELETE` triggers enforce append-only storage. Metadata is serialized only after the server's
per-action allowlist removes unapproved and sensitive fields. Rollback is restoration of the verified backup.

### 0007_integer_money_reports.sql

Additive integer-money cutover for catalog and reporting. It backfills `products.price_cents` and
`customers.ltv_cents` with `ROUND(value * 100)`, snapshots `order_items.category_snapshot`, and keeps the
legacy decimal projections synchronized for old writers. Product price cents and order/item cents are the
authoritative commercial values; customer LTV remains a compatibility projection, while analytics derive
spend from non-cancelled orders. Historical category snapshots are immutable. Validate fresh bootstrap and
upgrade on a disposable copy before rollout; rollback is restoration of the verified pre-migration backup.

## How to Run Migrations

### SQLite (Current Database)

The current runtime creates the SQLite bootstrap schema from `server/db.ts` and validates critical schema state at startup/healthcheck. Do not run raw SQL migrations manually in production.

The legacy constraints migration is blocked by default and can only be run through the guarded wrapper after a verified backup:

```bash
ALLOW_DESTRUCTIVE_CONSTRAINT_MIGRATION=true BACKUP_CONFIRMED=true npm run db:migrate:constraints
```

### Important Notes

1. **SQLite Limitation**: SQLite does not support adding CHECK constraints to existing tables via `ALTER TABLE`. The migration script recreates tables with constraints.

2. **Data Migration**: The migration script includes data migration logic that:
   - Preserves all existing data
   - Adjusts invalid values to meet constraints (e.g., negative values set to 0)
   - Maintains all indexes and foreign key relationships

3. **Schema Updates**: The Drizzle ORM schema (`shared/schema.ts`) has been updated to include these constraints, ensuring they are present in any future table creations.

4. **Rollback**: Restore the verified SQLite backup. Do not attempt ad hoc reverse table rebuilds in production.

## Verification

To verify that constraints are in place:

```sql
-- Check table definitions
SELECT sql FROM sqlite_master WHERE type='table' AND name IN ('products', 'orders', 'customers', 'campaigns');

-- The output should show CHECK constraints in the CREATE TABLE statements
```

## Testing Constraints

You can test that constraints are working by attempting to insert invalid data:

```sql
-- This should fail (negative price)
INSERT INTO products (tenant_id, name, category, price, stock)
VALUES (1, 'Test Product', 'Electronics', -10.00, 5);

-- This should fail (open_rate > 100)
INSERT INTO campaigns (tenant_id, name, channel, audience, open_rate)
VALUES (1, 'Test Campaign', 'email', 'all', 150.5);
```

## Migration Best Practices

1. **Backup First**: Always backup your database before running migrations
2. **Test on Dev**: Test migrations on a development/staging database first
3. **Review Data**: Check for existing data that might violate new constraints
4. **Monitor Performance**: Some constraints may impact write performance
5. **Document Changes**: Keep this README updated with any new migrations
