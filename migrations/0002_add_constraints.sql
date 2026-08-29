-- Migration: Add CHECK Constraints for Data Validation
-- Description: Adds CHECK constraints to ensure data integrity across key tables
-- Compatible with: SQLite
-- Generated: 2024-12-15
--
-- WARNING:
-- This is a legacy destructive migration that rebuilds tables using DROP TABLE.
-- Do not execute this SQL file directly against production or any database with
-- real data. Use the guarded wrapper only after a verified backup:
--
--   ALLOW_DESTRUCTIVE_CONSTRAINT_MIGRATION=true BACKUP_CONFIRMED=true npm run db:migrate:constraints

-- Note: SQLite does not support adding CHECK constraints to existing tables via ALTER TABLE.
-- We need to recreate tables with CHECK constraints.
-- This migration will be applied during table creation or requires table recreation.

-- ==================== PRODUCTS TABLE ====================
-- Constraint: price must be >= 0
-- Constraint: stock must be >= 0

-- Create new products table with constraints
CREATE TABLE IF NOT EXISTS products_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0 CHECK(price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
  status TEXT NOT NULL DEFAULT 'active',
  image TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Copy data from old table (if exists)
INSERT INTO products_new (id, tenant_id, name, category, price, stock, status, image, created_at, updated_at)
SELECT id, tenant_id, name, category,
       CASE WHEN price < 0 THEN 0 ELSE price END,
       CASE WHEN stock < 0 THEN 0 ELSE stock END,
       status, image, created_at, updated_at
FROM products
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='products');

-- Drop old table and rename new one
DROP TABLE IF EXISTS products;
ALTER TABLE products_new RENAME TO products;

-- Recreate indexes for products
CREATE INDEX IF NOT EXISTS products_tenant_id_idx ON products(tenant_id);
CREATE INDEX IF NOT EXISTS products_category_idx ON products(category);
CREATE INDEX IF NOT EXISTS products_status_idx ON products(status);
CREATE INDEX IF NOT EXISTS products_tenant_category_idx ON products(tenant_id, category);

-- ==================== ORDERS TABLE ====================
-- Constraint: total must be >= 0

-- Create new orders table with constraints
CREATE TABLE IF NOT EXISTS orders_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer TEXT NOT NULL,
  order_date TEXT DEFAULT (datetime('now')),
  total REAL NOT NULL DEFAULT 0 CHECK(total >= 0),
  status TEXT NOT NULL DEFAULT 'pending',
  items INTEGER NOT NULL DEFAULT 0,
  method TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Copy data from old table (if exists)
INSERT INTO orders_new (id, tenant_id, order_id, customer_id, customer, order_date, total, status, items, method, created_at, updated_at)
SELECT id, tenant_id, order_id, customer_id, customer, order_date,
       CASE WHEN total < 0 THEN 0 ELSE total END,
       status, items, method, created_at, updated_at
FROM orders
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='orders');

-- Drop old table and rename new one
DROP TABLE IF EXISTS orders;
ALTER TABLE orders_new RENAME TO orders;

-- Recreate indexes for orders
CREATE INDEX IF NOT EXISTS orders_tenant_id_idx ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders(customer_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at);
CREATE INDEX IF NOT EXISTS orders_order_date_idx ON orders(order_date);
CREATE INDEX IF NOT EXISTS orders_tenant_status_idx ON orders(tenant_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS orders_tenant_order_id_unique ON orders(tenant_id, order_id);

-- ==================== CUSTOMERS TABLE ====================
-- Constraint: ltv must be >= 0

-- Create new customers table with constraints
CREATE TABLE IF NOT EXISTS customers_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  segment TEXT NOT NULL,
  ltv REAL NOT NULL DEFAULT 0 CHECK(ltv >= 0),
  last_purchase TEXT,
  favorite_category TEXT,
  image TEXT,
  birth_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Copy data from old table (if exists)
INSERT INTO customers_new (id, tenant_id, name, email, phone, segment, ltv, last_purchase, favorite_category, image, birth_date, created_at, updated_at)
SELECT id, tenant_id, name, email, phone, segment,
       CASE WHEN ltv < 0 THEN 0 ELSE ltv END,
       last_purchase, favorite_category, image, birth_date, created_at, updated_at
FROM customers
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='customers');

-- Drop old table and rename new one
DROP TABLE IF EXISTS customers;
ALTER TABLE customers_new RENAME TO customers;

-- Recreate indexes for customers
CREATE INDEX IF NOT EXISTS customers_tenant_id_idx ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS customers_email_idx ON customers(email);
CREATE INDEX IF NOT EXISTS customers_segment_idx ON customers(segment);
CREATE INDEX IF NOT EXISTS customers_created_at_idx ON customers(created_at);
CREATE INDEX IF NOT EXISTS customers_tenant_segment_idx ON customers(tenant_id, segment);

-- ==================== CAMPAIGNS TABLE ====================
-- Constraint: open_rate must be between 0 and 100
-- Constraint: conversion must be between 0 and 100

-- Create new campaigns table with constraints
CREATE TABLE IF NOT EXISTS campaigns_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL,
  audience TEXT NOT NULL,
  message TEXT,
  sent INTEGER NOT NULL DEFAULT 0,
  open_rate REAL NOT NULL DEFAULT 0 CHECK(open_rate >= 0 AND open_rate <= 100),
  conversion REAL NOT NULL DEFAULT 0 CHECK(conversion >= 0 AND conversion <= 100),
  revenue REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Copy data from old table (if exists)
INSERT INTO campaigns_new (id, tenant_id, name, channel, audience, message, sent, open_rate, conversion, revenue, status, scheduled_at, created_at, updated_at)
SELECT id, tenant_id, name, channel, audience, message, sent,
       CASE
         WHEN open_rate < 0 THEN 0
         WHEN open_rate > 100 THEN 100
         ELSE open_rate
       END,
       CASE
         WHEN conversion < 0 THEN 0
         WHEN conversion > 100 THEN 100
         ELSE conversion
       END,
       revenue, status, scheduled_at, created_at, updated_at
FROM campaigns
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='campaigns');

-- Drop old table and rename new one
DROP TABLE IF EXISTS campaigns;
ALTER TABLE campaigns_new RENAME TO campaigns;

-- Recreate indexes for campaigns
CREATE INDEX IF NOT EXISTS campaigns_tenant_id_idx ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS campaigns_status_idx ON campaigns(status);
CREATE INDEX IF NOT EXISTS campaigns_created_at_idx ON campaigns(created_at);
CREATE INDEX IF NOT EXISTS campaigns_channel_idx ON campaigns(channel);

-- ==================== VERIFICATION ====================
-- Query to verify constraints are in place
-- Run: SELECT sql FROM sqlite_master WHERE type='table' AND name IN ('products', 'orders', 'customers', 'campaigns');
