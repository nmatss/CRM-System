import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { sqlite } from "./db";

const appDbPath = resolve(process.env.DATABASE_PATH || "./data/zippcrm.db");
export const SESSION_DB_PATH = process.env.SESSION_DATABASE_PATH
  ? resolve(process.env.SESSION_DATABASE_PATH)
  : appDbPath;

export const usingSeparateSessionDatabase = SESSION_DB_PATH !== appDbPath;

function createSessionDatabase(): Database.Database {
  if (!usingSeparateSessionDatabase) {
    return sqlite;
  }

  const sessionDbDir = dirname(SESSION_DB_PATH);
  if (!existsSync(sessionDbDir)) {
    mkdirSync(sessionDbDir, { recursive: true });
  }

  const db = new Database(SESSION_DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  return db;
}

export const sessionSqlite = createSessionDatabase();
