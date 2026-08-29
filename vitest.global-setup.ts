import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";

const originalWorkingDirectory = process.cwd();
const originalDatabasePath = process.env.DATABASE_PATH;
const originalSessionDatabasePath = process.env.SESSION_DATABASE_PATH;
const testWorkingDirectory = mkdtempSync(join(tmpdir(), "zippcrm-vitest-"));

// This setup runs inside the serial backend worker before every test file. A file-scoped
// cwd prevents process-wide SQLite modules and relative test paths from sharing databases.
process.chdir(testWorkingDirectory);
process.env.DATABASE_PATH = "./data/test.db";
process.env.SESSION_DATABASE_PATH = "./data/test-sessions.db";

afterAll(() => {
  process.chdir(originalWorkingDirectory);

  if (originalDatabasePath === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = originalDatabasePath;

  if (originalSessionDatabasePath === undefined) delete process.env.SESSION_DATABASE_PATH;
  else process.env.SESSION_DATABASE_PATH = originalSessionDatabasePath;

  rmSync(testWorkingDirectory, { force: true, recursive: true });
});
