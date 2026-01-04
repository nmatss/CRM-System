# Database CHECK Constraints Reference

Quick reference guide for all CHECK constraints added in migration 0002.

## Constraints by Table

### products
| Column | Constraint | Description |
|--------|------------|-------------|
| `price` | `price >= 0` | Product price must be non-negative |
| `stock` | `stock >= 0` | Stock quantity must be non-negative |

**Example violations:**
```sql
-- ❌ Will fail
INSERT INTO products (tenant_id, name, category, price, stock)
VALUES (1, 'Widget', 'Electronics', -5.99, 10);

-- ❌ Will fail  
INSERT INTO products (tenant_id, name, category, price, stock)
VALUES (1, 'Widget', 'Electronics', 5.99, -10);

-- ✅ Will succeed
INSERT INTO products (tenant_id, name, category, price, stock)
VALUES (1, 'Widget', 'Electronics', 5.99, 10);
```

---

### orders
| Column | Constraint | Description |
|--------|------------|-------------|
| `total` | `total >= 0` | Order total must be non-negative |

**Example violations:**
```sql
-- ❌ Will fail
INSERT INTO orders (tenant_id, order_id, customer, total, method)
VALUES (1, 'ORD-001', 'John Doe', -99.99, 'credit');

-- ✅ Will succeed
INSERT INTO orders (tenant_id, order_id, customer, total, method)
VALUES (1, 'ORD-001', 'John Doe', 99.99, 'credit');
```

---

### customers
| Column | Constraint | Description |
|--------|------------|-------------|
| `ltv` | `ltv >= 0` | Customer lifetime value must be non-negative |

**Example violations:**
```sql
-- ❌ Will fail
INSERT INTO customers (tenant_id, name, email, segment, ltv)
VALUES (1, 'Jane Smith', 'jane@example.com', 'premium', -500.00);

-- ✅ Will succeed
INSERT INTO customers (tenant_id, name, email, segment, ltv)
VALUES (1, 'Jane Smith', 'jane@example.com', 'premium', 500.00);
```

---

### campaigns
| Column | Constraint | Description |
|--------|------------|-------------|
| `open_rate` | `open_rate >= 0 AND open_rate <= 100` | Open rate must be between 0 and 100 (percentage) |
| `conversion` | `conversion >= 0 AND conversion <= 100` | Conversion rate must be between 0 and 100 (percentage) |

**Example violations:**
```sql
-- ❌ Will fail (negative open_rate)
INSERT INTO campaigns (tenant_id, name, channel, audience, open_rate, conversion)
VALUES (1, 'Summer Sale', 'email', 'all', -5.0, 10.0);

-- ❌ Will fail (open_rate > 100)
INSERT INTO campaigns (tenant_id, name, channel, audience, open_rate, conversion)
VALUES (1, 'Summer Sale', 'email', 'all', 150.5, 10.0);

-- ❌ Will fail (conversion > 100)
INSERT INTO campaigns (tenant_id, name, channel, audience, open_rate, conversion)
VALUES (1, 'Summer Sale', 'email', 'all', 45.5, 120.0);

-- ✅ Will succeed
INSERT INTO campaigns (tenant_id, name, channel, audience, open_rate, conversion)
VALUES (1, 'Summer Sale', 'email', 'all', 45.5, 10.0);
```

---

## All Constraints Summary

| Table | Column | Constraint SQL |
|-------|--------|----------------|
| products | price | `CHECK(price >= 0)` |
| products | stock | `CHECK(stock >= 0)` |
| orders | total | `CHECK(total >= 0)` |
| customers | ltv | `CHECK(ltv >= 0)` |
| campaigns | open_rate | `CHECK(open_rate >= 0 AND open_rate <= 100)` |
| campaigns | conversion | `CHECK(conversion >= 0 AND conversion <= 100)` |

---

## Drizzle ORM Schema Constraints

In the Drizzle ORM schema (`shared/schema.ts`), constraints are defined as:

```typescript
// Products
check("products_price_check", sql`${table.price} >= 0`)
check("products_stock_check", sql`${table.stock} >= 0`)

// Orders
check("orders_total_check", sql`${table.total} >= 0`)

// Customers
check("customers_ltv_check", sql`${table.ltv} >= 0`)

// Campaigns
check("campaigns_open_rate_check", sql`${table.openRate} >= 0 AND ${table.openRate} <= 100`)
check("campaigns_conversion_check", sql`${table.conversion} >= 0 AND ${table.conversion} <= 100`)
```

---

## Error Messages

When a constraint is violated, SQLite will return an error like:

```
Error: CHECK constraint failed: price >= 0
Error: CHECK constraint failed: open_rate >= 0 AND open_rate <= 100
```

Make sure your application handles these errors gracefully and provides user-friendly feedback.

---

## Testing Constraints

To verify constraints are active:

```sql
-- Check table definitions
SELECT sql FROM sqlite_master WHERE type='table' AND name IN ('products', 'orders', 'customers', 'campaigns');

-- Look for CHECK clauses in the output
```

To test a specific constraint:

```sql
-- Test products.price constraint
BEGIN TRANSACTION;
INSERT INTO products (tenant_id, name, category, price, stock)
VALUES (1, 'Test', 'Test', -1, 0);
-- Should fail with: CHECK constraint failed: price >= 0
ROLLBACK;

-- Test campaigns.open_rate constraint  
BEGIN TRANSACTION;
INSERT INTO campaigns (tenant_id, name, channel, audience, open_rate, conversion)
VALUES (1, 'Test', 'email', 'all', 999, 0);
-- Should fail with: CHECK constraint failed: open_rate >= 0 AND open_rate <= 100
ROLLBACK;
```

---

## Notes

- All constraints are enforced at the database level
- Constraints apply to both INSERT and UPDATE operations
- Constraints are checked BEFORE the data is written to disk
- Applications should validate data before sending to database for better UX
- Database constraints provide a second layer of validation for data integrity
