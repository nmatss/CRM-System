import { sqlite } from "../db";
import { logger } from "../logger";
import { enqueueJob, toSqliteTimestamp, PermanentJobError, type ClaimedJob } from "../outbox";
import { deliver } from "./delivery";
import {
  SUPPORTED_AUTOMATION_ACTIONS,
  SUPPORTED_AUTOMATION_TRIGGERS,
  type AutomationTrigger,
  type DeliveryChannel,
} from "@shared/schema";

/**
 * Automation engine (ADR 0001).
 *
 * A domain event fans out to the active automations that declare the matching
 * trigger. Enqueueing happens inside the caller's SQLite transaction, so an
 * automation can never fire for a business write that was rolled back, and the
 * idempotency key makes a duplicated event a no-op.
 */

export const AUTOMATION_JOB_TYPE = "automation.execute";

export interface DomainEvent {
  tenantId: number;
  triggerType: AutomationTrigger;
  /** Identifier of the entity that produced the event (customer id, order id, ...). */
  referenceId: number | string;
}

interface AutomationDefinitionRow {
  id: number;
  version: number;
  action_type: string;
  action_channel: string;
}

export function isSupportedTrigger(value: unknown): value is AutomationTrigger {
  return (
    typeof value === "string" &&
    (SUPPORTED_AUTOMATION_TRIGGERS as readonly string[]).includes(value)
  );
}

export function isSupportedAction(value: unknown): boolean {
  return (
    typeof value === "string" && (SUPPORTED_AUTOMATION_ACTIONS as readonly string[]).includes(value)
  );
}

export function automationExecutionKey(
  automationId: number,
  version: number,
  triggerType: string,
  referenceId: number | string,
): string {
  return `automation:${automationId}:v${version}:${triggerType}:${referenceId}`;
}

/**
 * Synchronous on purpose: callers invoke it from inside an open
 * `sqlite.transaction` so the business write and the jobs commit together.
 * Returns the number of automations that were scheduled.
 */
export function enqueueAutomationJobsForEvent(event: DomainEvent): number {
  if (!isSupportedTrigger(event.triggerType)) return 0;

  const automations = sqlite
    .prepare(
      `SELECT id, version, action_type, action_channel
         FROM automations
        WHERE tenant_id = ? AND trigger_type = ? AND is_active = 1`,
    )
    .all(event.tenantId, event.triggerType) as AutomationDefinitionRow[];

  let scheduled = 0;
  for (const automation of automations) {
    if (!isSupportedAction(automation.action_type)) continue;

    enqueueJob({
      tenantId: event.tenantId,
      type: AUTOMATION_JOB_TYPE,
      idempotencyKey: automationExecutionKey(
        automation.id,
        automation.version,
        event.triggerType,
        event.referenceId,
      ),
      payload: {
        automationId: automation.id,
        automationVersion: automation.version,
        triggerType: event.triggerType,
        triggerReference: String(event.referenceId),
        actionType: automation.action_type,
        actionChannel: automation.action_channel,
      },
    });
    scheduled += 1;
  }

  return scheduled;
}

interface AutomationJobPayload {
  automationId: number;
  automationVersion: number;
  triggerType: string;
  triggerReference: string;
  actionType: string;
  actionChannel: DeliveryChannel;
}

function parsePayload(job: ClaimedJob): AutomationJobPayload {
  const payload = job.payload as Partial<AutomationJobPayload>;
  if (
    typeof payload.automationId !== "number" ||
    typeof payload.automationVersion !== "number" ||
    typeof payload.triggerType !== "string" ||
    typeof payload.triggerReference !== "string" ||
    typeof payload.actionType !== "string" ||
    typeof payload.actionChannel !== "string"
  ) {
    throw new PermanentJobError("Malformed automation job payload");
  }
  return payload as AutomationJobPayload;
}

/** Resolves which customer an action should reach for each supported trigger. */
function resolveTargetCustomerId(
  tenantId: number,
  triggerType: string,
  reference: string,
): number | null {
  const referenceId = Number(reference);
  if (!Number.isSafeInteger(referenceId) || referenceId <= 0) return null;

  if (triggerType === "customer.created") {
    const row = sqlite
      .prepare("SELECT id FROM customers WHERE id = ? AND tenant_id = ?")
      .get(referenceId, tenantId) as { id: number } | undefined;
    return row?.id ?? null;
  }

  if (triggerType === "order.created") {
    const row = sqlite
      .prepare("SELECT customer_id AS customerId FROM orders WHERE id = ? AND tenant_id = ?")
      .get(referenceId, tenantId) as { customerId: number | null } | undefined;
    return row?.customerId ?? null;
  }

  return null;
}

export async function handleAutomationJob(job: ClaimedJob): Promise<void> {
  const payload = parsePayload(job);
  const idempotencyKey = automationExecutionKey(
    payload.automationId,
    payload.automationVersion,
    payload.triggerType,
    payload.triggerReference,
  );

  const existing = sqlite
    .prepare(
      "SELECT id, status FROM automation_executions WHERE tenant_id = ? AND idempotency_key = ?",
    )
    .get(job.tenantId, idempotencyKey) as { id: number; status: string } | undefined;

  // A repeated event must not run the action twice.
  if (existing && (existing.status === "succeeded" || existing.status === "skipped")) {
    return;
  }

  const startedAt = toSqliteTimestamp(new Date());
  const executionId =
    existing?.id ??
    (
      sqlite
        .prepare(
          `INSERT INTO automation_executions
             (tenant_id, automation_id, automation_version, trigger_type, trigger_reference, idempotency_key, status, attempts, started_at)
           VALUES (?, ?, ?, ?, ?, ?, 'processing', 0, ?)
           RETURNING id`,
        )
        .get(
          job.tenantId,
          payload.automationId,
          payload.automationVersion,
          payload.triggerType,
          payload.triggerReference,
          idempotencyKey,
          startedAt,
        ) as { id: number }
    ).id;

  sqlite
    .prepare(
      "UPDATE automation_executions SET status = 'processing', attempts = attempts + 1, started_at = COALESCE(started_at, ?) WHERE id = ?",
    )
    .run(startedAt, executionId);

  const finalize = (status: string, error: string | null) => {
    sqlite
      .prepare(
        "UPDATE automation_executions SET status = ?, error = ?, finished_at = ? WHERE id = ?",
      )
      .run(status, error, toSqliteTimestamp(new Date()), executionId);
  };

  // The definition may have been deactivated or bumped while the job waited.
  const definition = sqlite
    .prepare(
      "SELECT id, version, is_active AS isActive FROM automations WHERE id = ? AND tenant_id = ?",
    )
    .get(payload.automationId, job.tenantId) as
    { id: number; version: number; isActive: number } | undefined;

  if (!definition) {
    finalize("skipped", "Automation no longer exists");
    return;
  }
  if (!definition.isActive) {
    finalize("skipped", "Automation is paused");
    return;
  }
  if (definition.version !== payload.automationVersion) {
    finalize("skipped", "Automation definition changed after the event");
    return;
  }

  const customerId = resolveTargetCustomerId(
    job.tenantId,
    payload.triggerType,
    payload.triggerReference,
  );
  if (customerId === null) {
    finalize("skipped", "Trigger reference has no reachable customer");
    return;
  }

  const outcome = await deliver({
    tenantId: job.tenantId,
    customerId,
    channel: payload.actionChannel,
    templateKey: `automation:${payload.automationId}`,
    correlationId: idempotencyKey,
  });

  switch (outcome.status) {
    case "delivered":
      finalize("succeeded", null);
      return;
    case "skipped_opt_out":
      finalize("skipped", outcome.reason);
      return;
    case "not_configured":
      // Truthful terminal state: nothing was delivered and retrying will not help.
      finalize("failed", outcome.reason);
      logger.info("Automation action could not run: channel not configured", {
        tenantId: job.tenantId,
        automationId: payload.automationId,
        channel: payload.actionChannel,
      });
      return;
    case "failed":
      finalize("failed", outcome.reason);
      if (outcome.permanent) {
        throw new PermanentJobError(outcome.reason);
      }
      throw new Error(outcome.reason);
  }
}

export interface AutomationHistoryEntry {
  id: number;
  automationId: number;
  automationTitle: string;
  automationVersion: number;
  triggerType: string;
  triggerReference: string | null;
  status: string;
  attempts: number;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

/** Real execution history, scoped to the active tenant. */
export function getAutomationHistory(
  tenantId: number,
  options: { limit: number; offset: number; automationId?: number },
): { data: AutomationHistoryEntry[]; total: number } {
  const filters = ["e.tenant_id = @tenantId"];
  const params: Record<string, unknown> = {
    tenantId,
    limit: options.limit,
    offset: options.offset,
  };
  if (options.automationId !== undefined) {
    filters.push("e.automation_id = @automationId");
    params.automationId = options.automationId;
  }
  const where = filters.join(" AND ");

  const total = (
    sqlite
      .prepare(`SELECT COUNT(*) AS total FROM automation_executions e WHERE ${where}`)
      .get(params) as { total: number }
  ).total;

  const data = sqlite
    .prepare(
      `SELECT e.id AS id,
              e.automation_id AS automationId,
              COALESCE(a.title, 'Automação removida') AS automationTitle,
              e.automation_version AS automationVersion,
              e.trigger_type AS triggerType,
              e.trigger_reference AS triggerReference,
              e.status AS status,
              e.attempts AS attempts,
              e.error AS error,
              e.started_at AS startedAt,
              e.finished_at AS finishedAt,
              e.created_at AS createdAt
         FROM automation_executions e
         LEFT JOIN automations a ON a.id = e.automation_id AND a.tenant_id = e.tenant_id
        WHERE ${where}
        ORDER BY e.created_at DESC, e.id DESC
        LIMIT @limit OFFSET @offset`,
    )
    .all(params) as AutomationHistoryEntry[];

  return { data, total };
}
