import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "@shared/schema";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";

// Database file path - stored in data directory
const DB_PATH = process.env.DATABASE_PATH || "./data/zippcrm.db";

// Ensure data directory exists
const dbDir = dirname(DB_PATH);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// Create SQLite database connection
const sqlite = new Database(DB_PATH);

// Enable foreign keys and WAL mode for better performance
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });

// Export raw sqlite connection for health checks
export { sqlite };
