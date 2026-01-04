#!/usr/bin/env node
/**
 * Apply CHECK Constraints Migration
 *
 * This script applies the 0002_add_constraints.sql migration to the SQLite database.
 * It adds CHECK constraints to ensure data integrity for:
 * - products.price >= 0
 * - products.stock >= 0
 * - orders.total >= 0
 * - customers.ltv >= 0
 * - campaigns.openRate between 0 and 100
 * - campaigns.conversion between 0 and 100
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.DATABASE_PATH || join(__dirname, '..', 'data', 'zippcrm.db');
const MIGRATION_PATH = join(__dirname, '..', 'migrations', '0002_add_constraints.sql');

console.log('='.repeat(60));
console.log('ZippiCRM - Applying CHECK Constraints Migration');
console.log('='.repeat(60));
console.log();

try {
  // Read migration file
  console.log('📄 Reading migration file...');
  const migrationSQL = readFileSync(MIGRATION_PATH, 'utf-8');

  // Connect to database
  console.log('🔌 Connecting to database:', DB_PATH);
  const db = new Database(DB_PATH);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Check if tables exist
  console.log('🔍 Checking existing tables...');
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name IN ('products', 'orders', 'customers', 'campaigns')
  `).all();

  console.log(`   Found ${tables.length} tables to migrate:`, tables.map(t => t.name).join(', '));
  console.log();

  // Backup reminder
  console.log('⚠️  IMPORTANT: Make sure you have a backup of your database!');
  console.log('   Database location:', DB_PATH);
  console.log();

  // Execute migration
  console.log('🚀 Applying migration...');

  // Split migration into individual statements and execute
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  db.transaction(() => {
    for (const statement of statements) {
      try {
        db.prepare(statement).run();
      } catch (err) {
        // Ignore errors for IF NOT EXISTS statements
        if (!err.message.includes('already exists')) {
          throw err;
        }
      }
    }
  })();

  console.log('✅ Migration applied successfully!');
  console.log();

  // Verify constraints
  console.log('🔍 Verifying constraints...');
  const constraintsCheck = {
    products: db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='products'").get(),
    orders: db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'").get(),
    customers: db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='customers'").get(),
    campaigns: db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='campaigns'").get()
  };

  const hasConstraints = {
    products: constraintsCheck.products?.sql?.includes('CHECK'),
    orders: constraintsCheck.orders?.sql?.includes('CHECK'),
    customers: constraintsCheck.customers?.sql?.includes('CHECK'),
    campaigns: constraintsCheck.campaigns?.sql?.includes('CHECK')
  };

  console.log('   Products table has constraints:', hasConstraints.products ? '✅' : '❌');
  console.log('   Orders table has constraints:', hasConstraints.orders ? '✅' : '❌');
  console.log('   Customers table has constraints:', hasConstraints.customers ? '✅' : '❌');
  console.log('   Campaigns table has constraints:', hasConstraints.campaigns ? '✅' : '❌');
  console.log();

  // Close database
  db.close();

  console.log('='.repeat(60));
  console.log('✨ Migration completed successfully!');
  console.log('='.repeat(60));

  process.exit(0);

} catch (error) {
  console.error();
  console.error('❌ Migration failed!');
  console.error('Error:', error.message);
  console.error();
  console.error('Stack trace:');
  console.error(error.stack);
  process.exit(1);
}
