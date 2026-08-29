import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.DATABASE_PATH || "./data/zippcrm.db";

console.log("");
console.log("========================================");
console.log("🔧 Applying Cashback Transactions Migration");
console.log("========================================");
console.log("");

try {
  // Connect to database
  const db = new Database(DB_PATH);

  console.log(`📂 Database: ${DB_PATH}`);
  console.log("");

  // Read migration file
  const migrationPath = join(__dirname, "../migrations/0003_cashback_transactions.sql");
  const migrationSQL = readFileSync(migrationPath, "utf-8");

  // Remove comments and split by semicolons
  const cleanedSQL = migrationSQL
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  const statements = cleanedSQL
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`📋 Executing ${statements.length} statements...`);
  console.log("");

  // Enable foreign keys
  db.prepare("PRAGMA foreign_keys = ON").run();

  // Execute each statement
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    try {
      db.prepare(statement).run();
      console.log(`✅ Statement ${i + 1}/${statements.length} executed successfully`);
    } catch (error) {
      // Ignore "already exists" errors
      if (error.message.includes("already exists")) {
        console.log(`⚠️  Statement ${i + 1}/${statements.length} skipped (already exists)`);
      } else {
        console.error(`❌ Error executing statement ${i + 1}:`, error.message);
        console.error("Statement:", statement.substring(0, 100) + "...");
        throw error;
      }
    }
  }

  // Verify table was created
  const tableCheck = db
    .prepare(
      `
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='cashback_transactions'
  `,
    )
    .get();

  if (tableCheck) {
    console.log("");
    console.log("========================================");
    console.log("✅ Migration completed successfully!");
    console.log("========================================");
    console.log("");
    console.log('📊 Table "cashback_transactions" is ready.');

    // Show table info
    const columns = db.prepare(`PRAGMA table_info(cashback_transactions)`).all();
    console.log("");
    console.log("Columns:");
    columns.forEach((col) => {
      console.log(`  - ${col.name} (${col.type})`);
    });
  } else {
    console.error("❌ Table was not created successfully.");
    process.exit(1);
  }

  db.close();
  console.log("");
} catch (error) {
  console.error("");
  console.error("========================================");
  console.error("❌ Migration failed!");
  console.error("========================================");
  console.error("");
  console.error("Error:", error.message);
  console.error("");
  process.exit(1);
}
