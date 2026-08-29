# Migration 0002: CHECK Constraints Implementation

## Date: 2024-12-15

## Objective

Add CHECK constraints to the SQLite database to ensure data integrity and validation for critical fields across multiple tables.

## Changes Made

### 1. Database Migration File

Created `/home/nic20/ProjetosWeb/ZippiCRM/migrations/0002_add_constraints.sql`

This migration adds the following CHECK constraints:

#### Products Table

- **price >= 0**: Ensures product prices are never negative
- **stock >= 0**: Ensures stock quantities are never negative

#### Orders Table

- **total >= 0**: Ensures order totals are never negative

#### Customers Table

- **ltv >= 0**: Ensures customer lifetime value is never negative

#### Campaigns Table

- **open_rate >= 0 AND open_rate <= 100**: Ensures open rates are valid percentages (0-100%)
- **conversion >= 0 AND conversion <= 100**: Ensures conversion rates are valid percentages (0-100%)

### 2. Schema Definition Updates

Updated `/home/nic20/ProjetosWeb/ZippiCRM/shared/schema.ts`

Added CHECK constraints to the Drizzle ORM schema definitions using the `check()` function:

- Imported `check` from "drizzle-orm/sqlite-core"
- Added constraints to products, orders, customers, and campaigns tables
- Ensures future table creations automatically include these constraints

### 3. Migration Application Script

Created `/home/nic20/ProjetosWeb/ZippiCRM/scripts/apply-constraints.js`

A Node.js script that:

- Reads the migration SQL file
- Applies the migration to the SQLite database
- Validates that constraints were successfully applied
- Provides detailed console output and error handling

Added npm script: `npm run db:migrate:constraints`

### 4. Documentation

Created `/home/nic20/ProjetosWeb/ZippiCRM/migrations/README.md`

Comprehensive documentation covering:

- Overview of all migrations
- Detailed constraint specifications
- How to run migrations
- SQLite-specific considerations
- Verification steps
- Testing procedures
- Best practices

## Technical Implementation Details

### SQLite Constraint Limitations

SQLite does not support adding CHECK constraints to existing tables via `ALTER TABLE`. The migration handles this by:

1. Creating new tables with `_new` suffix including CHECK constraints
2. Copying data from old tables with value normalization:
   - Negative values are set to 0
   - Out-of-range percentages are clamped to 0-100
3. Dropping old tables
4. Renaming new tables to original names
5. Recreating all indexes and maintaining foreign key relationships

### Data Migration Safety

The migration includes logic to:

- Only execute if tables exist (using `WHERE EXISTS` clauses)
- Preserve all existing data during table recreation
- Maintain referential integrity through proper foreign key handling
- Recreate all indexes to maintain query performance

## How to Apply

### Option 1: Using npm script (Recommended)

```bash
npm run db:migrate:constraints
```

### Option 2: Using tsx directly

```bash
tsx scripts/apply-constraints.js
```

### Option 3: Manual SQL execution (Advanced)

```bash
# Backup your database first!
sqlite3 data/zippcrm.db < migrations/0002_add_constraints.sql
```

## Verification

After applying the migration, verify constraints are in place:

```sql
SELECT sql FROM sqlite_master WHERE type='table' AND name='products';
-- Should show: CHECK(price >= 0) and CHECK(stock >= 0)

SELECT sql FROM sqlite_master WHERE type='table' AND name='campaigns';
-- Should show: CHECK(open_rate >= 0 AND open_rate <= 100) and CHECK(conversion >= 0 AND conversion <= 100)
```

## Testing

Test that constraints are enforced:

```sql
-- This should fail with constraint violation
INSERT INTO products (tenant_id, name, category, price, stock)
VALUES (1, 'Test', 'Test', -10, 5);
-- Expected: Error: CHECK constraint failed: price >= 0

-- This should fail with constraint violation
INSERT INTO campaigns (tenant_id, name, channel, audience, open_rate)
VALUES (1, 'Test', 'email', 'all', 150);
-- Expected: Error: CHECK constraint failed: open_rate >= 0 AND open_rate <= 100
```

## Impact Assessment

### Performance

- **Minimal impact**: CHECK constraints are evaluated during INSERT/UPDATE operations only
- Constraints use simple comparison operators which are very fast
- No impact on SELECT queries

### Data Integrity

- **High value**: Prevents invalid data at the database level
- Complements application-level validation
- Provides defense-in-depth security model

### Application Compatibility

- **Fully compatible**: Existing application code continues to work
- Invalid data insertion attempts will fail with clear error messages
- Drizzle ORM will enforce constraints automatically

## Rollback Plan

If needed, tables can be recreated without constraints by:

1. Creating tables using old schema definition
2. Copying data from constrained tables
3. Dropping constrained tables and renaming new ones

**Note**: Rollback is generally not recommended as it reduces data integrity protection.

## Files Modified/Created

1. **Created**: `migrations/0002_add_constraints.sql` (7.4 KB)
2. **Updated**: `shared/schema.ts` (added check imports and constraints)
3. **Created**: `scripts/apply-constraints.js` (executable migration script)
4. **Created**: `migrations/README.md` (comprehensive documentation)
5. **Updated**: `package.json` (added db:migrate:constraints script)
6. **Created**: `migrations/MIGRATION_SUMMARY.md` (this file)

## Build Verification

Project build tested and confirmed successful:

```bash
npm run build
# ✅ Client build: successful
# ✅ Server build: successful
```

## Next Steps

1. **Backup database** before applying migration in production
2. **Test migration** on development/staging environment first
3. **Apply migration** using `npm run db:migrate:constraints`
4. **Verify constraints** using SQL queries mentioned above
5. **Monitor application** for any constraint violation errors
6. **Update application error handling** to provide user-friendly messages for constraint violations

## Conclusion

This migration significantly improves data integrity by enforcing validation rules at the database level. All constraints are now part of both the SQL schema and the Drizzle ORM definition, ensuring consistency across all database operations.
