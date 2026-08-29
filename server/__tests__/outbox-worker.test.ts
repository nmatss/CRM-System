import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "crypto";

/**
 * Acceptance criteria of ADR 0001: idempotency, expired lease recovery, retry
 * with backoff, dead-letter, atomicity between the business write and the job,
 * and cross-tenant isolation.
 */
describe("durable outbox worker", () => {
  let outbox: typeof import("../outbox");
  let sqlite: (typeof import("../db"))["sqlite"];
  let storage: (typeof import("../storage"))["storage"];
  let tenantId: number;
  let otherTenantId: number;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_PATH = "./data/test-outbox.db";
    process.env.SESSION_DATABASE_PATH = "./data/test-outbox-sessions.db";

    outbox = await import("../outbox");
    ({ sqlite } = await import("../db"));
    ({ storage } = await import("../storage"));

    const suffix = randomUUID();
    tenantId = (
      await storage.createTenant({
        name: "Outbox Tenant",
        slug: `outbox-${suffix}`,
        plan: "test",
        status: "active",
      })
    ).id;
    otherTenantId = (
      await storage.createTenant({
        name: "Outbox Other Tenant",
        slug: `outbox-other-${suffix}`,
        plan: "test",
        status: "active",
      })
    ).id;
  });

  beforeEach(() => {
    // Claim order is global, so each case starts from an empty queue.
    sqlite.prepare("DELETE FROM outbox_jobs").run();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the existing job for a repeated key and rejects a divergent payload", () => {
    const key = `idem-${randomUUID()}`;
    const first = outbox.enqueueJob({
      tenantId,
      type: "test.noop",
      idempotencyKey: key,
      payload: { a: 1, b: 2 },
    });

    // Key order must not change the request hash.
    const repeated = outbox.enqueueJob({
      tenantId,
      type: "test.noop",
      idempotencyKey: key,
      payload: { b: 2, a: 1 },
    });
    expect(repeated.id).toBe(first.id);

    expect(() =>
      outbox.enqueueJob({
        tenantId,
        type: "test.noop",
        idempotencyKey: key,
        payload: { a: 99 },
      }),
    ).toThrow(outbox.OutboxConflictError);

    // The same key is free for a different tenant.
    const otherTenantJob = outbox.enqueueJob({
      tenantId: otherTenantId,
      type: "test.noop",
      idempotencyKey: key,
      payload: { a: 99 },
    });
    expect(otherTenantJob.id).not.toBe(first.id);
    expect(otherTenantJob.tenant_id).toBe(otherTenantId);
  });

  it("claims one job at a time and reclaims it only after the lease expires", () => {
    const key = `lease-${randomUUID()}`;
    const start = new Date("2026-08-29T12:00:00.000Z");
    const job = outbox.enqueueJob({
      tenantId,
      type: "test.lease",
      idempotencyKey: key,
      payload: {},
      availableAt: start,
    });

    const claimed = outbox.claimNextJob("worker-a", 60_000, start);
    expect(claimed?.id).toBe(job.id);
    expect(claimed?.attempts).toBe(1);

    // A second worker cannot take a job whose lease is still valid.
    const duringLease = new Date(start.getTime() + 30_000);
    expect(outbox.claimNextJob("worker-b", 60_000, duringLease)).toBeNull();

    // After the lease expires the job is recoverable, which is what makes a
    // crashed process safe.
    const afterLease = new Date(start.getTime() + 61_000);
    const reclaimed = outbox.claimNextJob("worker-b", 60_000, afterLease);
    expect(reclaimed?.id).toBe(job.id);
    expect(reclaimed?.attempts).toBe(2);

    outbox.completeJob(job.id);
    const row = sqlite.prepare("SELECT status FROM outbox_jobs WHERE id = ?").get(job.id) as {
      status: string;
    };
    expect(row.status).toBe("succeeded");
  });

  it("retries with growing backoff and then moves the job to dead_letter", () => {
    const key = `retry-${randomUUID()}`;
    const now = new Date("2026-08-29T12:00:00.000Z");
    const job = outbox.enqueueJob({
      tenantId,
      type: "test.retry",
      idempotencyKey: key,
      payload: {},
      maxAttempts: 2,
      availableAt: now,
    });

    outbox.claimNextJob("worker-a", 1000, now);
    expect(outbox.failJob(job.id, "transient", { now, random: () => 0 })).toBe("retry_wait");

    const afterFirst = sqlite
      .prepare(
        "SELECT status, available_at AS availableAt, last_error AS lastError FROM outbox_jobs WHERE id = ?",
      )
      .get(job.id) as { status: string; availableAt: string; lastError: string };
    expect(afterFirst.status).toBe("retry_wait");
    expect(afterFirst.lastError).toBe("transient");
    expect(afterFirst.availableAt > outbox.toSqliteTimestamp(now)).toBe(true);

    // Second attempt exhausts max_attempts.
    outbox.claimNextJob("worker-a", 1000, new Date(now.getTime() + 60_000));
    expect(outbox.failJob(job.id, "still failing", { now })).toBe("dead_letter");

    const dead = sqlite.prepare("SELECT status FROM outbox_jobs WHERE id = ?").get(job.id) as {
      status: string;
    };
    expect(dead.status).toBe("dead_letter");
    expect(outbox.computeBackoffMs(1, () => 0)).toBeLessThan(outbox.computeBackoffMs(4, () => 0));
    expect(outbox.computeBackoffMs(50, () => 0)).toBeLessThanOrEqual(300_000);
  });

  it("dead-letters a job whose type has no registered handler", async () => {
    const worker = new outbox.OutboxWorker({ owner: "handlerless" });
    const job = outbox.enqueueJob({
      tenantId,
      type: `test.unknown-${randomUUID()}`,
      idempotencyKey: `unknown-${randomUUID()}`,
      payload: {},
    });

    let processed = false;
    for (let i = 0; i < 20 && !processed; i += 1) {
      await worker.runOnce();
      const row = sqlite.prepare("SELECT status FROM outbox_jobs WHERE id = ?").get(job.id) as {
        status: string;
      };
      processed = row.status === "dead_letter";
    }
    expect(processed).toBe(true);
  });

  it("commits the job with the business write and discards both on rollback", async () => {
    const key = `atomic-${randomUUID()}`;
    const customerEmail = `atomic-${randomUUID()}@example.com`;

    expect(() =>
      sqlite.transaction(() => {
        sqlite
          .prepare(
            "INSERT INTO customers (tenant_id, name, email, segment) VALUES (?, ?, ?, 'VIP')",
          )
          .run(tenantId, "Rollback Customer", customerEmail);
        outbox.enqueueJob({
          tenantId,
          type: "test.atomic",
          idempotencyKey: key,
          payload: {},
        });
        throw new Error("business rule rejected the write");
      })(),
    ).toThrow("business rule rejected the write");

    const customer = sqlite
      .prepare("SELECT id FROM customers WHERE email = ?")
      .get(customerEmail) as { id: number } | undefined;
    const job = sqlite
      .prepare("SELECT id FROM outbox_jobs WHERE tenant_id = ? AND idempotency_key = ?")
      .get(tenantId, key) as { id: number } | undefined;

    expect(customer).toBeUndefined();
    expect(job).toBeUndefined();
  });

  it("reports a backlog snapshot scoped to one tenant", () => {
    const key = `backlog-${randomUUID()}`;
    outbox.enqueueJob({ tenantId, type: "test.backlog", idempotencyKey: key, payload: {} });

    const scoped = outbox.getOutboxBacklog(tenantId);
    const other = outbox.getOutboxBacklog(otherTenantId);
    expect(scoped.pending).toBeGreaterThan(0);
    expect(other.pending + other.retryWait + other.processing).toBeLessThan(
      scoped.pending + scoped.retryWait + scoped.processing,
    );
  });

  it("only cancels a job that has not started processing", () => {
    const key = `cancel-${randomUUID()}`;
    const job = outbox.enqueueJob({
      tenantId,
      type: "test.cancel",
      idempotencyKey: key,
      payload: {},
    });

    expect(outbox.cancelJob(otherTenantId, job.id)).toBe(false);
    expect(outbox.cancelJob(tenantId, job.id)).toBe(true);

    const running = outbox.enqueueJob({
      tenantId,
      type: "test.cancel",
      idempotencyKey: `cancel-running-${randomUUID()}`,
      payload: {},
    });
    expect(outbox.claimNextJob("worker-a", 60_000)?.id).toBe(running.id);
    expect(outbox.cancelJob(tenantId, running.id)).toBe(false);
  });
});
