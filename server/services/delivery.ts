import { sqlite } from "../db";
import { logger } from "../logger";
import { notificationService } from "./notifications";
import type { DeliveryChannel } from "@shared/schema";

/**
 * Delivery boundary for campaigns, automations and notifications (ADR 0001).
 *
 * Two rules are absolute here: an adapter that is not configured fails closed
 * and never invents a provider message ID, and no recipient address or message
 * body is ever logged.
 */

export type DeliveryOutcome =
  | { status: "delivered"; providerMessageId: string }
  | { status: "not_configured"; reason: string }
  | { status: "skipped_opt_out"; reason: string }
  | { status: "failed"; reason: string; permanent: boolean };

export interface DeliveryRequest {
  tenantId: number;
  customerId: number;
  channel: DeliveryChannel;
  /** Identifies the template; the body is resolved at delivery time, never stored in the job. */
  templateKey: string;
  correlationId: string;
}

const PROVIDER_ENV: Record<DeliveryChannel, string> = {
  email: "EMAIL_PROVIDER",
  sms: "SMS_PROVIDER",
  whatsapp: "WHATSAPP_PROVIDER",
};

/** A channel is only usable when the platform explicitly configured a provider. */
export function isChannelConfigured(channel: DeliveryChannel): boolean {
  const value = process.env[PROVIDER_ENV[channel]];
  return typeof value === "string" && value.trim().length > 0;
}

export function configuredChannels(): DeliveryChannel[] {
  return (["email", "sms", "whatsapp"] as const).filter(isChannelConfigured);
}

interface RecipientRow {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  marketing_opt_out: number;
}

/**
 * Consent is re-evaluated immediately before delivery, not only when the
 * audience was materialized, because a customer may opt out while queued.
 */
export function resolveRecipient(
  tenantId: number,
  customerId: number,
): { row: RecipientRow } | { error: DeliveryOutcome } {
  const row = sqlite
    .prepare(
      "SELECT id, name, email, phone, marketing_opt_out FROM customers WHERE id = ? AND tenant_id = ?",
    )
    .get(customerId, tenantId) as RecipientRow | undefined;

  if (!row) {
    return {
      error: {
        status: "failed",
        reason: "Recipient not found in the active tenant",
        permanent: true,
      },
    };
  }
  if (row.marketing_opt_out) {
    return { error: { status: "skipped_opt_out", reason: "Recipient opted out of marketing" } };
  }
  return { row };
}

function hasAddressFor(channel: DeliveryChannel, row: RecipientRow): boolean {
  if (channel === "email") return Boolean(row.email && row.email.trim());
  return Boolean(row.phone && row.phone.trim());
}

/**
 * Attempts one delivery. The returned outcome is the only source of truth for
 * campaign and automation state; nothing upstream may assume success.
 */
export async function deliver(request: DeliveryRequest): Promise<DeliveryOutcome> {
  if (!isChannelConfigured(request.channel)) {
    return {
      status: "not_configured",
      reason: `No provider configured for channel ${request.channel}`,
    };
  }

  const resolved = resolveRecipient(request.tenantId, request.customerId);
  if ("error" in resolved) return resolved.error;

  if (!hasAddressFor(request.channel, resolved.row)) {
    return {
      status: "failed",
      reason: `Recipient has no ${request.channel} address`,
      permanent: true,
    };
  }

  try {
    const result = await notificationService.send({
      tenantId: request.tenantId,
      userId: String(request.customerId),
      type: request.templateKey,
      channel: request.channel,
      title: request.templateKey,
      message: request.templateKey,
    });

    if (result.success && result.messageId) {
      return { status: "delivered", providerMessageId: result.messageId };
    }

    return {
      status: "failed",
      reason: result.error ?? "Provider did not acknowledge the message",
      permanent: false,
    };
  } catch (error) {
    // Correlate by IDs only. Recipient and body must never reach the log.
    logger.error("Delivery adapter raised", {
      tenantId: request.tenantId,
      channel: request.channel,
      correlationId: request.correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      status: "failed",
      reason: "Delivery adapter error",
      permanent: false,
    };
  }
}
