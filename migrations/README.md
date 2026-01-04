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
Adds CHECK constraints for data validation (SQLite specific). This migration ensures data integrity by adding the following constraints:

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

## How to Run Migrations

### SQLite (Current Database)

The constraints have been added to the schema file (`shared/schema.ts`) and will be automatically applied when:
1. Creating new tables via Drizzle ORM
2. Running the migration SQL file manually

To apply the migration manually:

```bash
# Using sqlite3 CLI
sqlite3 data/zippcrm.db < migrations/0002_add_constraints.sql

# Using Node.js with better-sqlite3
npm run migrate
```

### Important Notes

1. **SQLite Limitation**: SQLite does not support adding CHECK constraints to existing tables via `ALTER TABLE`. The migration script recreates tables with constraints.

2. **Data Migration**: The migration script includes data migration logic that:
   - Preserves all existing data
   - Adjusts invalid values to meet constraints (e.g., negative values set to 0)
   - Maintains all indexes and foreign key relationships

3. **Schema Updates**: The Drizzle ORM schema (`shared/schema.ts`) has been updated to include these constraints, ensuring they are present in any future table creations.

4. **Rollback**: To rollback this migration, you would need to recreate the tables without the CHECK constraints. However, this is generally not recommended as the constraints enforce data integrity.

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
