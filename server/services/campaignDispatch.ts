import { sqlite } from "../db";
import { logger } from "../logger";
import { enqueueJob, toSqliteTimestamp, PermanentJobError, type ClaimedJob } from "../outbox";
import { deliver } from "./delivery";
import { SUPPORTED_DELIVERY_CHANNELS, type DeliveryChannel } from "@shared/schema";

/**
 * Campaign dispatch (ADR 0001).
 *
 * Requesting a send materializes every recipient and enqueues the job in one
 * transaction. Nothing reports "sent" until an adapter acknowledged a specific
 * recipient, so the counters shown in the UI are always backed by rows.
 */

export const CAMPAIGN_JOB_TYPE = "campaign.dispatch";

/** Only these batch sizes of recipients are processed per attempt. */
const RECIPIENT_BATCH = 200;

export class CampaignDispatchError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "UNSUPPORTED_CHANNEL" | "EMPTY_AUDIENCE" | "ALREADY_RUNNING",
    message: string,
  ) {
    super(message);
    this.name = "CampaignDispatchError";
  }
}

/**
 * Audience definitions the server can actually resolve. An audience outside
 * this map cannot be dispatched, instead of silently targeting everyone.
 */
const AUDIENCE_PREDICATES: Record<string, string> = {
  "Todos os clientes": "1 = 1",
  "Clientes VIP": "c.segment = 'VIP'",
  "Novos clientes": "c.segment = 'Novo'",
  "Clientes inativos": "c.segment IN ('Inativo', 'Em Risco')",
  "Aniversariantes do mês":
    "c.birth_date IS NOT NULL AND strftime('%m', c.birth_date) = strftime('%m', 'now')",
};

export function supportedAudiences(): string[] {
  return Object.keys(AUDIENCE_PREDICATES);
}

function normalizeChannel(channel: string): DeliveryChannel | null {
  const value = channel.trim().toLowerCase();
  const match = (SUPPORTED_DELIVERY_CHANNELS as readonly string[]).find(
    (candidate) => candidate === value,
  );
  return (match as DeliveryChannel | undefined) ?? null;
}

export interface CampaignExecutionSummary {
  id: number;
  campaignId: number;
  status: string;
  channel: string;
  audience: string;
  totalRecipients: number;
  deliveredCount: number;
  failedCount: number;
  skippedCount: number;
  createdAt: string;
  finishedAt: string | null;
}

function loadExecution(
  tenantId: number,
  executionId: number,
): CampaignExecutionSummary | undefined {
  return sqlite
    .prepare(
      `SELECT id, campaign_id AS campaignId, status, channel, audience,
              total_recipients AS totalRecipients, delivered_count AS deliveredCount,
              failed_count AS failedCount, skipped_count AS skippedCount,
              created_at AS createdAt, finished_at AS finishedAt
         FROM campaign_executions
        WHERE id = ? AND tenant_id = ?`,
    )
    .get(executionId, tenantId) as CampaignExecutionSummary | undefined;
}

export interface RequestDispatchInput {
  tenantId: number;
  campaignId: number;
  actorUserId?: string | null;
}

/**
 * Requests a dispatch. Idempotent per campaign definition: asking twice for the
 * same unchanged campaign returns the execution that already exists instead of
 * duplicating deliveries.
 */
export function requestCampaignDispatch(input: RequestDispatchInput): {
  execution: CampaignExecutionSummary;
  created: boolean;
} {
  const campaign = sqlite
    .prepare(
      "SELECT id, channel, audience, status, updated_at AS updatedAt FROM campaigns WHERE id = ? AND tenant_id = ?",
    )
    .get(input.campaignId, input.tenantId) as
    | { id: number; channel: string; audience: string; status: string; updatedAt: string | null }
    | undefined;

  if (!campaign) {
    throw new CampaignDispatchError("NOT_FOUND", "Campanha não encontrada");
  }

  const channel = normalizeChannel(campaign.channel);
  if (!channel) {
    throw new CampaignDispatchError(
      "UNSUPPORTED_CHANNEL",
      `Canal não suportado para envio: ${campaign.channel}`,
    );
  }

  const predicate = AUDIENCE_PREDICATES[campaign.audience];
  if (!predicate) {
    throw new CampaignDispatchError(
      "EMPTY_AUDIENCE",
      `Audiência não suportada para envio: ${campaign.audience}`,
    );
  }

  // The definition timestamp is part of the key, so editing the campaign
  // deliberately produces a new execution while a double click does not.
  const idempotencyKey = `campaign:${campaign.id}:${campaign.updatedAt ?? "initial"}`;

  const existing = sqlite
    .prepare("SELECT id FROM campaign_executions WHERE tenant_id = ? AND idempotency_key = ?")
    .get(input.tenantId, idempotencyKey) as { id: number } | undefined;

  if (existing) {
    return { execution: loadExecution(input.tenantId, existing.id)!, created: false };
  }

  const executionId = sqlite.transaction(() => {
    const created = sqlite
      .prepare(
        `INSERT INTO campaign_executions
           (tenant_id, campaign_id, idempotency_key, channel, audience, status, requested_by)
         VALUES (?, ?, ?, ?, ?, 'scheduled', ?)
         RETURNING id`,
      )
      .get(
        input.tenantId,
        campaign.id,
        idempotencyKey,
        channel,
        campaign.audience,
        input.actorUserId ?? null,
      ) as { id: number };

    // Consent is applied while materializing, and again before each delivery.
    const inserted = sqlite
      .prepare(
        `INSERT INTO campaign_recipients (tenant_id, execution_id, campaign_id, customer_id, channel, status)
         SELECT c.tenant_id, ?, ?, c.id, ?, 'pending'
           FROM customers c
          WHERE c.tenant_id = ? AND c.marketing_opt_out = 0 AND (${predicate})`,
      )
      .run(created.id, campaign.id, channel, input.tenantId);

    sqlite
      .prepare(
        "UPDATE campaign_executions SET total_recipients = ?, updated_at = datetime('now') WHERE id = ?",
      )
      .run(inserted.changes, created.id);

    // `updated_at` is intentionally preserved: it is part of the idempotency
    // key, so scheduling a send must not look like a definition change.
    sqlite
      .prepare(
        "UPDATE campaigns SET status = 'scheduled', updated_at = updated_at WHERE id = ? AND tenant_id = ?",
      )
      .run(campaign.id, input.tenantId);

    enqueueJob({
      tenantId: input.tenantId,
      type: CAMPAIGN_JOB_TYPE,
      idempotencyKey,
      payload: { campaignId: campaign.id, executionId: created.id },
    });

    return created.id;
  })();

  return { execution: loadExecution(input.tenantId, executionId)!, created: true };
}

interface CampaignJobPayload {
  campaignId: number;
  executionId: number;
}

function parsePayload(job: ClaimedJob): CampaignJobPayload {
  const payload = job.payload as Partial<CampaignJobPayload>;
  if (typeof payload.campaignId !== "number" || typeof payload.executionId !== "number") {
    throw new PermanentJobError("Malformed campaign dispatch payload");
  }
  return payload as CampaignJobPayload;
}

function refreshExecutionCounters(tenantId: number, executionId: number): void {
  sqlite
    .prepare(
      `UPDATE campaign_executions
          SET delivered_count = (SELECT COUNT(*) FROM campaign_recipients WHERE execution_id = @executionId AND status = 'delivered'),
              failed_count    = (SELECT COUNT(*) FROM campaign_recipients WHERE execution_id = @executionId AND status IN ('failed', 'not_configured')),
              skipped_count   = (SELECT COUNT(*) FROM campaign_recipients WHERE execution_id = @executionId AND status = 'skipped_opt_out'),
              updated_at      = datetime('now')
        WHERE id = @executionId AND tenant_id = @tenantId`,
    )
    .run({ executionId, tenantId });
}

export async function handleCampaignDispatchJob(job: ClaimedJob): Promise<void> {
  const payload = parsePayload(job);
  const execution = loadExecution(job.tenantId, payload.executionId);
  if (!execution) {
    throw new PermanentJobError("Campaign execution no longer exists");
  }
  if (execution.status === "completed" || execution.status === "cancelled") {
    return;
  }

  const channel = normalizeChannel(execution.channel);
  if (!channel) {
    throw new PermanentJobError(`Unsupported channel ${execution.channel}`);
  }

  sqlite
    .prepare(
      "UPDATE campaign_executions SET status = 'processing', updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
    )
    .run(execution.id, job.tenantId);

  const pending = sqlite
    .prepare(
      `SELECT id, customer_id AS customerId
         FROM campaign_recipients
        WHERE execution_id = ? AND tenant_id = ? AND status = 'pending'
        ORDER BY id ASC
        LIMIT ?`,
    )
    .all(execution.id, job.tenantId, RECIPIENT_BATCH) as Array<{
    id: number;
    customerId: number;
  }>;

  const isLastAttempt = job.attempts >= job.maxAttempts;
  let transientFailures = 0;

  for (const recipient of pending) {
    const outcome = await deliver({
      tenantId: job.tenantId,
      customerId: recipient.customerId,
      channel,
      templateKey: `campaign:${payload.campaignId}`,
      correlationId: `campaign:${payload.campaignId}:execution:${execution.id}`,
    });

    let status: string;
    let providerMessageId: string | null = null;
    let failureReason: string | null = null;

    switch (outcome.status) {
      case "delivered":
        status = "delivered";
        providerMessageId = outcome.providerMessageId;
        break;
      case "skipped_opt_out":
        status = "skipped_opt_out";
        failureReason = outcome.reason;
        break;
      case "not_configured":
        status = "not_configured";
        failureReason = outcome.reason;
        break;
      case "failed":
        failureReason = outcome.reason;
        if (outcome.permanent || isLastAttempt) {
          status = "failed";
        } else {
          // Stays pending so the next attempt retries only what did not resolve.
          status = "pending";
          transientFailures += 1;
        }
        break;
    }

    sqlite
      .prepare(
        `UPDATE campaign_recipients
            SET status = ?, attempts = attempts + 1, provider_message_id = ?, failure_reason = ?, updated_at = datetime('now')
          WHERE id = ? AND tenant_id = ?`,
      )
      .run(status, providerMessageId, failureReason, recipient.id, job.tenantId);
  }

  refreshExecutionCounters(job.tenantId, execution.id);

  const remaining = (
    sqlite
      .prepare(
        "SELECT COUNT(*) AS count FROM campaign_recipients WHERE execution_id = ? AND status = 'pending'",
      )
      .get(execution.id) as { count: number }
  ).count;

  if (remaining > 0 && !isLastAttempt) {
    // More work to do: let the outbox reschedule this job with backoff.
    throw new Error(`${remaining} recipient(s) still pending delivery`);
  }

  const counters = loadExecution(job.tenantId, execution.id)!;
  const finalStatus = counters.deliveredCount > 0 ? "completed" : "failed";

  sqlite
    .prepare(
      "UPDATE campaign_executions SET status = ?, finished_at = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
    )
    .run(finalStatus, toSqliteTimestamp(new Date()), execution.id, job.tenantId);

  // `sent` reflects acknowledged deliveries only.
  sqlite
    .prepare("UPDATE campaigns SET sent = ?, status = ? WHERE id = ? AND tenant_id = ?")
    .run(
      counters.deliveredCount,
      counters.deliveredCount > 0 ? "sent" : "failed",
      payload.campaignId,
      job.tenantId,
    );

  logger.info("Campaign dispatch finished", {
    tenantId: job.tenantId,
    campaignId: payload.campaignId,
    executionId: execution.id,
    delivered: counters.deliveredCount,
    failed: counters.failedCount,
    skipped: counters.skippedCount,
    transientFailures,
  });
}

export function listCampaignExecutions(
  tenantId: number,
  options: { limit: number; offset: number; campaignId?: number },
): { data: CampaignExecutionSummary[]; total: number } {
  const filters = ["tenant_id = @tenantId"];
  const params: Record<string, unknown> = {
    tenantId,
    limit: options.limit,
    offset: options.offset,
  };
  if (options.campaignId !== undefined) {
    filters.push("campaign_id = @campaignId");
    params.campaignId = options.campaignId;
  }
  const where = filters.join(" AND ");

  const total = (
    sqlite
      .prepare(`SELECT COUNT(*) AS total FROM campaign_executions WHERE ${where}`)
      .get(params) as { total: number }
  ).total;

  const data = sqlite
    .prepare(
      `SELECT id, campaign_id AS campaignId, status, channel, audience,
              total_recipients AS totalRecipients, delivered_count AS deliveredCount,
              failed_count AS failedCount, skipped_count AS skippedCount,
              created_at AS createdAt, finished_at AS finishedAt
         FROM campaign_executions
        WHERE ${where}
        ORDER BY created_at DESC, id DESC
        LIMIT @limit OFFSET @offset`,
    )
    .all(params) as CampaignExecutionSummary[];

  return { data, total };
}

export interface CampaignDeliveryStats {
  executions: number;
  totalRecipients: number;
  delivered: number;
  failed: number;
  skipped: number;
  pending: number;
}

/**
 * Delivery statistics derived from persisted recipients. Attribution metrics
 * (open rate, conversion, revenue) are deliberately absent: ADR 0002 keeps them
 * unavailable until real attribution events exist.
 */
export function getCampaignDeliveryStats(tenantId: number): CampaignDeliveryStats {
  const row = sqlite
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM campaign_executions WHERE tenant_id = @tenantId) AS executions,
         (SELECT COUNT(*) FROM campaign_recipients WHERE tenant_id = @tenantId) AS totalRecipients,
         (SELECT COUNT(*) FROM campaign_recipients WHERE tenant_id = @tenantId AND status = 'delivered') AS delivered,
         (SELECT COUNT(*) FROM campaign_recipients WHERE tenant_id = @tenantId AND status IN ('failed', 'not_configured')) AS failed,
         (SELECT COUNT(*) FROM campaign_recipients WHERE tenant_id = @tenantId AND status = 'skipped_opt_out') AS skipped,
         (SELECT COUNT(*) FROM campaign_recipients WHERE tenant_id = @tenantId AND status = 'pending') AS pending`,
    )
    .get({ tenantId }) as CampaignDeliveryStats;
  return row;
}

export function listCampaignRecipients(
  tenantId: number,
  executionId: number,
  options: { limit: number; offset: number },
): {
  data: Array<{
    id: number;
    customerId: number;
    channel: string;
    status: string;
    attempts: number;
    failureReason: string | null;
    updatedAt: string;
  }>;
  total: number;
} {
  const total = (
    sqlite
      .prepare(
        "SELECT COUNT(*) AS total FROM campaign_recipients WHERE tenant_id = ? AND execution_id = ?",
      )
      .get(tenantId, executionId) as { total: number }
  ).total;

  const data = sqlite
    .prepare(
      `SELECT id, customer_id AS customerId, channel, status, attempts,
              failure_reason AS failureReason, updated_at AS updatedAt
         FROM campaign_recipients
        WHERE tenant_id = ? AND execution_id = ?
        ORDER BY id ASC
        LIMIT ? OFFSET ?`,
    )
    .all(tenantId, executionId, options.limit, options.offset) as Array<{
    id: number;
    customerId: number;
    channel: string;
    status: string;
    attempts: number;
    failureReason: string | null;
    updatedAt: string;
  }>;

  return { data, total };
}
