#!/usr/bin/env node
import Database from "better-sqlite3";
import { createHash } from "crypto";
import { mkdirSync, readFileSync, statSync } from "fs";
import { basename, dirname, join } from "path";

const dbPath = process.env.DATABASE_PATH || join(process.cwd(), "data", "zippcrm.db");
const backupDir = process.env.BACKUP_DIR || join(dirname(dbPath), "backups");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = join(backupDir, `${basename(dbPath)}.${timestamp}.bak`);

mkdirSync(backupDir, { recursive: true });

const db = new Database(dbPath);

try {
  db.pragma("wal_checkpoint(TRUNCATE)");
  await db.backup(target);
} finally {
  db.close();
}

const backupDb = new Database(target, { readonly: true });
let integrity;
let foreignKeyIssues;

try {
  integrity = backupDb.prepare("PRAGMA integrity_check").get().integrity_check;
  foreignKeyIssues = backupDb.prepare("PRAGMA foreign_key_check").all().length;
} finally {
  backupDb.close();
}

if (integrity !== "ok" || foreignKeyIssues > 0) {
  console.error(JSON.stringify({ backup: target, integrity, foreignKeyIssues }, null, 2));
  process.exit(1);
}

const data = readFileSync(target);
const sha256 = createHash("sha256").update(data).digest("hex");
const size = statSync(target).size;

console.log(JSON.stringify({ backup: target, size, sha256, integrity, foreignKeyIssues }, null, 2));
