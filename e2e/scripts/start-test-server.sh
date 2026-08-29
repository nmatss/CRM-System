#!/usr/bin/env bash
# Prepares a disposable database, seeds the deterministic dataset and starts the
# production build. Playwright owns the lifecycle of this process.
set -euo pipefail

DATA_DIR="${E2E_DATA_DIR:?E2E_DATA_DIR must be set}"

rm -rf "$DATA_DIR"
mkdir -p "$DATA_DIR"

npx tsx e2e/scripts/seed-e2e.ts

exec node dist/index.cjs
