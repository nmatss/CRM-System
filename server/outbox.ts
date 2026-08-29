import { createHash, randomUUID } from "crypto";
import { sqlite } from "./db";
import { logger } from "./logger";
import type { OutboxJobStatus } from "@shared/schema";

/**
 * Durable outbox implementing ADR 0001.
 *
 * A business mutation and the job that carries its side effect are written in
 * the same SQLite transaction, so the system can never promise a delivery it
 * did not persist. The embedded worker claims jobs with a lease, which lets a
 * job survive a process crash without being executed twice concurrently.
 */

/** Wall-clock format used by `datetime('now')`, so SQL comparisons stay valid. */
export function toSqliteTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export class OutboxConflictError extends Error {
  constructor(
    message: string,
    readonly idempotencyKey: string,
  ) {
    super(message);
    this.name = "OutboxConflictError";
  }
}

export interface EnqueueJobInput {
  tenantId: number;
  type: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  payloadVersion?: number;
  maxAttempts?: number;
  availableAt?: Date;
}

export interface OutboxJobRow {
  id: number;
  tenant_id: number;
  type: string;
  payload_version: number;
  payload_json: string;
  idempotency_key: string;
  request_hash: string;
  status: OutboxJobStatus;
  attempts: number;
  max_attempts: number;
  available_at: string;
  lease_owner: string | null;
  lease_expires_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface ClaimedJob {
  id: number;
  tenantId: number;
  type: string;
  payloadVersion: number;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  attempts: number;
  maxAttempts: number;
}

/**
 * Canonical JSON so that a retry with semantically identical input produces the
 * same hash regardless of key order.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function hashJobRequest(
  type: string,
  payloadVersion: number,
  payload: Record<string, unknown>,
): string {
  return createHash("sha256")
    .update(JSON.stringify({ type, payloadVersion, payload: canonicalize(payload) }))
    .digest("hex");
}

/**
 * Enqueues a job. Safe to call inside an open `sqlite.transaction`, which is how
 * atomicity between the business write and the job is achieved.
 *
 * Repeating the same idempotency key with the same payload returns the existing
 * job; a divergent payload is a conflict and never silently overwrites.
 */
export function enqueueJob(input: EnqueueJobInput): OutboxJobRow {
  const payloadVersion = input.payloadVersion ?? 1;
  const payloadJson = JSON.stringify(input.payload ?? {});
  const requestHash = hashJobRequest(input.type, payloadVersion, input.payload ?? {});
  const availableAt = toSqliteTimestamp(input.availableAt ?? new Date());

  const existing = sqlite
    .prepare("SELECT * FROM outbox_jobs WHERE tenant_id = ? AND idempotency_key = ?")
    .get(input.tenantId, input.idempotencyKey) as OutboxJobRow | undefined;

  if (existing) {
    if (existing.request_hash !== requestHash) {
      throw new OutboxConflictError(
        "An outbox job with this idempotency key already exists with a different payload",
        input.idempotencyKey,
      );
    }
    return existing;
  }

  return sqlite
    .prepare(
      `INSERT INTO outbox_jobs
         (tenant_id, type, payload_version, payload_json, idempotency_key, request_hash, max_attempts, available_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .get(
      input.tenantId,
      input.type,
      payloadVersion,
      payloadJson,
      input.idempotencyKey,
      requestHash,
      input.maxAttempts ?? 5,
      availableAt,
    ) as OutboxJobRow;
}

/**
 * Atomically claims the next runnable job. A job whose lease expired is
 * reclaimable, which is what makes recovery after a crash possible.
 */
export function claimNextJob(owner: string, leaseMs: number, now = new Date()): ClaimedJob | null {
  const nowText = toSqliteTimestamp(now);
  const leaseExpiry = toSqliteTimestamp(new Date(now.getTime() + leaseMs));

  const row = sqlite
    .prepare(
      `UPDATE outbox_jobs
          SET status = 'processing',
              attempts = attempts + 1,
              lease_owner = ?,
              lease_expires_at = ?,
              updated_at = ?
        WHERE id = (
          SELECT id FROM outbox_jobs
           WHERE (status IN ('pending', 'retry_wait') AND available_at <= ?)
              OR (status = 'processing' AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?)
           ORDER BY available_at ASC, id ASC
           LIMIT 1
        )
        RETURNING *`,
    )
    .get(owner, leaseExpiry, nowText, nowText, nowText) as OutboxJobRow | undefined;

  if (!row) return null;

  return {
    id: row.id,
    tenantId: row.tenant_id,
    type: row.type,
    payloadVersion: row.payload_version,
    payload: JSON.parse(row.payload_json) as Record<string, unknown>,
    idempotencyKey: row.idempotency_key,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
  };
}

export function completeJob(jobId: number, now = new Date()): void {
  const nowText = toSqliteTimestamp(now);
  sqlite
    .prepare(
      `UPDATE outbox_jobs
          SET status = 'succeeded', lease_owner = NULL, lease_expires_at = NULL,
              last_error = NULL, completed_at = ?, updated_at = ?
        WHERE id = ?`,
    )
    .run(nowText, nowText, jobId);
}

/** Exponential backoff with jitter, capped so a poisoned job cannot starve the queue. */
export function computeBackoffMs(attempts: number, random = Math.random): number {
  const base = Math.min(1000 * 2 ** Math.max(0, attempts - 1), 300_000);
  return Math.round(base * (1 + random() * 0.2));
}

export interface FailJobOptions {
  permanent?: boolean;
  now?: Date;
  random?: () => number;
}

/**
 * Records a failed attempt. The job returns to the queue with backoff until it
 * exhausts its attempts or the failure is permanent, and then goes to
 * `dead_letter` where an operator can inspect it.
 */
export function failJob(
  jobId: number,
  error: string,
  { permanent = false, now = new Date(), random = Math.random }: FailJobOptions = {},
): OutboxJobStatus {
  const job = sqlite.prepare("SELECT * FROM outbox_jobs WHERE id = ?").get(jobId) as
    OutboxJobRow | undefined;
  if (!job) return "dead_letter";

  const nowText = toSqliteTimestamp(now);
  const exhausted = permanent || job.attempts >= job.max_attempts;

  if (exhausted) {
    sqlite
      .prepare(
        `UPDATE outbox_jobs
            SET status = 'dead_letter', lease_owner = NULL, lease_expires_at = NULL,
                last_error = ?, completed_at = ?, updated_at = ?
          WHERE id = ?`,
      )
      .run(error.slice(0, 500), nowText, nowText, jobId);
    return "dead_letter";
  }

  const nextAt = toSqliteTimestamp(
    new Date(now.getTime() + computeBackoffMs(job.attempts, random)),
  );
  sqlite
    .prepare(
      `UPDATE outbox_jobs
          SET status = 'retry_wait', lease_owner = NULL, lease_expires_at = NULL,
              last_error = ?, available_at = ?, updated_at = ?
        WHERE id = ?`,
    )
    .run(error.slice(0, 500), nextAt, nowText, jobId);
  return "retry_wait";
}

/** Cancellation is only accepted before the job starts processing. */
export function cancelJob(tenantId: number, jobId: number, now = new Date()): boolean {
  const nowText = toSqliteTimestamp(now);
  const result = sqlite
    .prepare(
      `UPDATE outbox_jobs
          SET status = 'cancelled', completed_at = ?, updated_at = ?
        WHERE id = ? AND tenant_id = ? AND status IN ('pending', 'retry_wait')`,
    )
    .run(nowText, nowText, jobId, tenantId);
  return result.changes > 0;
}

export interface OutboxBacklog {
  pending: number;
  processing: number;
  retryWait: number;
  deadLetter: number;
  oldestPendingAt: string | null;
}

/** Backlog snapshot for the runbook and for readiness reporting. */
export function getOutboxBacklog(tenantId?: number): OutboxBacklog {
  const scope = tenantId === undefined ? "" : " WHERE tenant_id = @tenantId";
  const params = tenantId === undefined ? {} : { tenantId };
  const row = sqlite
    .prepare(
      `SELECT
         SUM(status = 'pending') AS pending,
         SUM(status = 'processing') AS processing,
         SUM(status = 'retry_wait') AS retryWait,
         SUM(status = 'dead_letter') AS deadLetter,
         MIN(CASE WHEN status IN ('pending', 'retry_wait') THEN available_at END) AS oldestPendingAt
       FROM outbox_jobs${scope}`,
    )
    .get(params) as {
    pending: number | null;
    processing: number | null;
    retryWait: number | null;
    deadLetter: number | null;
    oldestPendingAt: string | null;
  };

  return {
    pending: row.pending ?? 0,
    processing: row.processing ?? 0,
    retryWait: row.retryWait ?? 0,
    deadLetter: row.deadLetter ?? 0,
    oldestPendingAt: row.oldestPendingAt ?? null,
  };
}

export type OutboxHandler = (job: ClaimedJob) => Promise<void>;

/** A handler may raise this to say the failure will never succeed on retry. */
export class PermanentJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentJobError";
  }
}

export interface OutboxWorkerOptions {
  pollIntervalMs?: number;
  leaseMs?: number;
  owner?: string;
}

/**
 * Embedded worker. It runs in the API process, which ADR 0001 accepts while a
 * single instance writes to the SQLite volume.
 */
export class OutboxWorker {
  private readonly handlers = new Map<string, OutboxHandler>();
  private readonly pollIntervalMs: number;
  private readonly leaseMs: number;
  private readonly owner: string;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private draining: Promise<void> | null = null;

  constructor(options: OutboxWorkerOptions = {}) {
    this.pollIntervalMs = options.pollIntervalMs ?? 2000;
    this.leaseMs = options.leaseMs ?? 60_000;
    this.owner = options.owner ?? `worker-${randomUUID()}`;
  }

  register(type: string, handler: OutboxHandler): this {
    this.handlers.set(type, handler);
    return this;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleNext(0);
    logger.info("Outbox worker started", { owner: this.owner });
  }

  /** Stops claiming new work and waits only for the job already in flight. */
  async stop(timeoutMs = 5000): Promise<void> {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.draining) {
      await Promise.race([
        this.draining,
        new Promise<void>((resolve) => setTimeout(resolve, timeoutMs).unref()),
      ]);
    }
    logger.info("Outbox worker stopped", { owner: this.owner });
  }

  private scheduleNext(delayMs: number): void {
    if (!this.running) return;
    this.timer = setTimeout(() => {
      void this.tick();
    }, delayMs);
    this.timer.unref();
  }

  private async tick(): Promise<void> {
    if (!this.running) return;
    const processed = await this.runOnce();
    this.scheduleNext(processed ? 0 : this.pollIntervalMs);
  }

  /**
   * Processes at most one job. Exposed so tests can drive the worker
   * deterministically instead of waiting on timers.
   */
  async runOnce(now = new Date()): Promise<boolean> {
    const job = claimNextJob(this.owner, this.leaseMs, now);
    if (!job) return false;

    const handler = this.handlers.get(job.type);
    if (!handler) {
      failJob(job.id, `No handler registered for job type ${job.type}`, { permanent: true });
      logger.error("Outbox job has no handler", { jobId: job.id, jobType: job.type });
      return true;
    }

    const work = (async () => {
      try {
        await handler(job);
        completeJob(job.id);
        logger.info("Outbox job succeeded", {
          jobId: job.id,
          jobType: job.type,
          tenantId: job.tenantId,
          attempts: job.attempts,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const status = failJob(job.id, message, {
          permanent: error instanceof PermanentJobError,
        });
        logger.error("Outbox job failed", {
          jobId: job.id,
          jobType: job.type,
          tenantId: job.tenantId,
          attempts: job.attempts,
          status,
          error: message,
        });
      }
    })();

    this.draining = work;
    await work;
    this.draining = null;
    return true;
  }
}

export const outboxWorker = new OutboxWorker();
