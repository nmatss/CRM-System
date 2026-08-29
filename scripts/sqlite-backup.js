#!/usr/bin/env node
import Database from "better-sqlite3";
import { createHash } from "crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "fs";
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

// A manifest next to each backup lets a restore be verified without trusting
// the operator's memory of which file is which.
const manifestPath = `${target}.json`;
const manifest = {
  backup: target,
  source: dbPath,
  createdAt: new Date().toISOString(),
  size,
  sha256,
  integrity,
  foreignKeyIssues,
};
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

// Retention. Keeping backups forever fills the volume and eventually takes the
// application down, which is the failure the backup was supposed to prevent.
const keep = Number.parseInt(process.env.BACKUP_KEEP ?? "14", 10);
const pruned = [];
if (Number.isInteger(keep) && keep > 0) {
  const prefix = `${basename(dbPath)}.`;
  const backups = readdirSync(backupDir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".bak"))
    .sort()
    .reverse();

  for (const stale of backups.slice(keep)) {
    for (const suffix of ["", "-wal", "-shm", ".json"]) {
      rmSync(join(backupDir, `${stale}${suffix}`), { force: true });
    }
    pruned.push(stale);
  }
}

console.log(
  JSON.stringify({ ...manifest, manifest: manifestPath, retained: keep, pruned }, null, 2),
);
