import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "crypto";

/**
 * Campaign dispatch and the automation engine must never report a delivery the
 * adapter did not acknowledge, must respect opt-out, and must stay inside the
 * active tenant.
 */
describe("campaign dispatch and automation engine", () => {
  let sqlite: (typeof import("../db"))["sqlite"];
  let storage: (typeof import("../storage"))["storage"];
  let dispatch: typeof import("../services/campaignDispatch");
  let engine: typeof import("../services/automationEngine");
  let outbox: typeof import("../outbox");
  let notifications: typeof import("../services/notifications");

  let tenantId: number;
  let otherTenantId: number;
  let vipCustomerId: number;
  let optedOutCustomerId: number;
  let foreignCustomerId: number;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_PATH = "./data/test-campaign-engine.db";
    process.env.SESSION_DATABASE_PATH = "./data/test-campaign-engine-sessions.db";

    ({ sqlite } = await import("../db"));
    ({ storage } = await import("../storage"));
    dispatch = await import("../services/campaignDispatch");
    engine = await import("../services/automationEngine");
    outbox = await import("../outbox");
    notifications = await import("../services/notifications");

    const suffix = randomUUID();
    tenantId = (
      await storage.createTenant({
        name: "Dispatch Tenant",
        slug: `dispatch-${suffix}`,
        plan: "test",
        status: "active",
      })
    ).id;
    otherTenantId = (
      await storage.createTenant({
        name: "Dispatch Other",
        slug: `dispatch-other-${suffix}`,
        plan: "test",
        status: "active",
      })
    ).id;

    vipCustomerId = (
      await storage.createCustomer({
        tenantId,
        name: "VIP Alvo",
        email: `vip-${suffix}@example.com`,
        phone: "+5511999990000",
        segment: "VIP",
      })
    ).id;
    optedOutCustomerId = (
      await storage.createCustomer({
        tenantId,
        name: "VIP Opt Out",
        email: `optout-${suffix}@example.com`,
        segment: "VIP",
      })
    ).id;
    sqlite
      .prepare("UPDATE customers SET marketing_opt_out = 1 WHERE id = ?")
      .run(optedOutCustomerId);

    foreignCustomerId = (
      await storage.createCustomer({
        tenantId: otherTenantId,
        name: "VIP Outro Tenant",
        email: `foreign-${suffix}@example.com`,
        segment: "VIP",
      })
    ).id;
  });

  beforeEach(() => {
    sqlite.prepare("DELETE FROM outbox_jobs").run();
    delete process.env.EMAIL_PROVIDER;
    delete process.env.SMS_PROVIDER;
    delete process.env.WHATSAPP_PROVIDER;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function createCampaign(channel: string, audience: string) {
    return storage.createCampaign({
      tenantId,
      name: `Campanha ${randomUUID()}`,
      channel,
      audience,
      message: "Mensagem de teste",
      status: "draft",
    });
  }

  it("materializes only consenting recipients of the active tenant", () => {
    return createCampaign("email", "Clientes VIP").then((campaign) => {
      const { execution, created } = dispatch.requestCampaignDispatch({
        tenantId,
        campaignId: campaign.id,
      });

      expect(created).toBe(true);
      expect(execution.status).toBe("scheduled");

      const recipients = sqlite
        .prepare("SELECT customer_id AS customerId FROM campaign_recipients WHERE execution_id = ?")
        .all(execution.id) as Array<{ customerId: number }>;
      const ids = recipients.map((row) => row.customerId);

      expect(ids).toContain(vipCustomerId);
      // Opt-out is applied while materializing, and the other tenant is invisible.
      expect(ids).not.toContain(optedOutCustomerId);
      expect(ids).not.toContain(foreignCustomerId);
      expect(execution.totalRecipients).toBe(ids.length);

      // Requesting again for the same definition returns the same execution.
      const repeated = dispatch.requestCampaignDispatch({ tenantId, campaignId: campaign.id });
      expect(repeated.created).toBe(false);
      expect(repeated.execution.id).toBe(execution.id);
    });
  });

  it("rejects an audience or channel the dispatcher cannot resolve", async () => {
    const badAudience = await createCampaign("email", "Carrinho abandonado");
    expect(() =>
      dispatch.requestCampaignDispatch({ tenantId, campaignId: badAudience.id }),
    ).toThrow(dispatch.CampaignDispatchError);

    const badChannel = await createCampaign("pombo-correio", "Clientes VIP");
    expect(() => dispatch.requestCampaignDispatch({ tenantId, campaignId: badChannel.id })).toThrow(
      dispatch.CampaignDispatchError,
    );

    expect(() =>
      dispatch.requestCampaignDispatch({ tenantId: otherTenantId, campaignId: badAudience.id }),
    ).toThrow(dispatch.CampaignDispatchError);
  });

  it("records every recipient as not_configured and never claims a send without a provider", async () => {
    const campaign = await createCampaign("email", "Clientes VIP");
    const { execution } = dispatch.requestCampaignDispatch({ tenantId, campaignId: campaign.id });

    const worker = new outbox.OutboxWorker({ owner: "test-campaign" }).register(
      dispatch.CAMPAIGN_JOB_TYPE,
      dispatch.handleCampaignDispatchJob,
    );
    expect(await worker.runOnce()).toBe(true);

    const statuses = sqlite
      .prepare(
        "SELECT status, provider_message_id AS providerMessageId FROM campaign_recipients WHERE execution_id = ?",
      )
      .all(execution.id) as Array<{ status: string; providerMessageId: string | null }>;

    expect(statuses.length).toBeGreaterThan(0);
    for (const row of statuses) {
      expect(row.status).toBe("not_configured");
      // No adapter acknowledged anything, so no message ID may be invented.
      expect(row.providerMessageId).toBeNull();
    }

    const finished = sqlite
      .prepare(
        "SELECT status, delivered_count AS delivered, failed_count AS failed FROM campaign_executions WHERE id = ?",
      )
      .get(execution.id) as { status: string; delivered: number; failed: number };
    expect(finished.status).toBe("failed");
    expect(finished.delivered).toBe(0);
    expect(finished.failed).toBe(statuses.length);

    const campaignRow = sqlite
      .prepare("SELECT sent, status FROM campaigns WHERE id = ?")
      .get(campaign.id) as { sent: number; status: string };
    expect(campaignRow.sent).toBe(0);
    expect(campaignRow.status).toBe("failed");
  });

  it("counts only acknowledged deliveries and does not resend on a repeated job", async () => {
    process.env.EMAIL_PROVIDER = "test-provider";
    const campaign = await createCampaign("email", "Clientes VIP");
    const { execution } = dispatch.requestCampaignDispatch({ tenantId, campaignId: campaign.id });

    const sendSpy = vi
      .spyOn(notifications.notificationService, "sendEmail")
      .mockResolvedValue({ success: true, messageId: "provider-123" });

    const worker = new outbox.OutboxWorker({ owner: "test-campaign-ok" }).register(
      dispatch.CAMPAIGN_JOB_TYPE,
      dispatch.handleCampaignDispatchJob,
    );
    await worker.runOnce();

    const callsAfterFirstRun = sendSpy.mock.calls.length;
    expect(callsAfterFirstRun).toBeGreaterThan(0);

    const finished = sqlite
      .prepare("SELECT status, delivered_count AS delivered FROM campaign_executions WHERE id = ?")
      .get(execution.id) as { status: string; delivered: number };
    expect(finished.status).toBe("completed");
    expect(finished.delivered).toBe(callsAfterFirstRun);

    const campaignRow = sqlite
      .prepare("SELECT sent FROM campaigns WHERE id = ?")
      .get(campaign.id) as {
      sent: number;
    };
    expect(campaignRow.sent).toBe(finished.delivered);

    // Replaying the same job must not deliver twice.
    await dispatch.handleCampaignDispatchJob({
      id: 1,
      tenantId,
      type: dispatch.CAMPAIGN_JOB_TYPE,
      payloadVersion: 1,
      payload: { campaignId: campaign.id, executionId: execution.id },
      idempotencyKey: "replay",
      attempts: 1,
      maxAttempts: 5,
    });
    expect(sendSpy.mock.calls.length).toBe(callsAfterFirstRun);
  });

  it("only reports delivery statistics backed by rows and never invents attribution", () => {
    const stats = dispatch.getCampaignDeliveryStats(tenantId);
    const persisted = sqlite
      .prepare("SELECT COUNT(*) AS total FROM campaign_recipients WHERE tenant_id = ?")
      .get(tenantId) as { total: number };
    expect(stats.totalRecipients).toBe(persisted.total);
    expect(stats.delivered + stats.failed + stats.skipped + stats.pending).toBe(persisted.total);

    const foreign = dispatch.getCampaignDeliveryStats(otherTenantId);
    expect(foreign.totalRecipients).toBe(0);
  });

  it("enqueues one job per active automation and executes it exactly once", async () => {
    const automation = await storage.createAutomation({
      tenantId,
      title: "Boas-vindas",
      description: "Notifica clientes novos",
      icon: "mail",
      isActive: true,
      triggerType: "customer.created",
      actionType: "notify_customer",
      actionChannel: "email",
    });

    const customer = await storage.createCustomer({
      tenantId,
      name: "Novo Cliente",
      email: `novo-${randomUUID()}@example.com`,
      segment: "Novo",
    });

    const job = sqlite
      .prepare(
        "SELECT id, idempotency_key AS idempotencyKey FROM outbox_jobs WHERE tenant_id = ? AND type = ?",
      )
      .get(tenantId, engine.AUTOMATION_JOB_TYPE) as
      { id: number; idempotencyKey: string } | undefined;
    expect(job?.idempotencyKey).toBe(
      engine.automationExecutionKey(automation.id, 1, "customer.created", customer.id),
    );

    process.env.EMAIL_PROVIDER = "test-provider";
    const sendSpy = vi
      .spyOn(notifications.notificationService, "sendEmail")
      .mockResolvedValue({ success: true, messageId: "auto-1" });

    const worker = new outbox.OutboxWorker({ owner: "test-automation" }).register(
      engine.AUTOMATION_JOB_TYPE,
      engine.handleAutomationJob,
    );
    await worker.runOnce();

    const history = engine.getAutomationHistory(tenantId, { limit: 10, offset: 0 });
    expect(history.total).toBe(1);
    expect(history.data[0].status).toBe("succeeded");
    expect(history.data[0].automationId).toBe(automation.id);
    expect(sendSpy).toHaveBeenCalledTimes(1);

    // The same event replayed must not run the action again.
    await engine.handleAutomationJob({
      id: 99,
      tenantId,
      type: engine.AUTOMATION_JOB_TYPE,
      payloadVersion: 1,
      payload: {
        automationId: automation.id,
        automationVersion: 1,
        triggerType: "customer.created",
        triggerReference: String(customer.id),
        actionType: "notify_customer",
        actionChannel: "email",
      },
      idempotencyKey: "replay",
      attempts: 1,
      maxAttempts: 5,
    });
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(engine.getAutomationHistory(tenantId, { limit: 10, offset: 0 }).total).toBe(1);
  });

  it("does not schedule paused automations and skips a definition changed after the event", async () => {
    const automation = await storage.createAutomation({
      tenantId,
      title: "Pausada",
      description: "Não deve executar",
      icon: "mail",
      isActive: false,
      triggerType: "customer.created",
      actionType: "notify_customer",
      actionChannel: "email",
    });

    sqlite.prepare("DELETE FROM outbox_jobs").run();
    await storage.createCustomer({
      tenantId,
      name: "Cliente Sem Automação",
      email: `pausada-${randomUUID()}@example.com`,
      segment: "Novo",
    });

    const scheduledForPaused = sqlite
      .prepare(
        "SELECT COUNT(*) AS total FROM outbox_jobs WHERE tenant_id = ? AND payload_json LIKE ?",
      )
      .get(tenantId, `%"automationId":${automation.id}%`) as { total: number };
    expect(scheduledForPaused.total).toBe(0);

    // A job carrying a stale version must be skipped, not executed.
    await engine.handleAutomationJob({
      id: 1234,
      tenantId,
      type: engine.AUTOMATION_JOB_TYPE,
      payloadVersion: 1,
      payload: {
        automationId: automation.id,
        automationVersion: 99,
        triggerType: "customer.created",
        triggerReference: "1",
        actionType: "notify_customer",
        actionChannel: "email",
      },
      idempotencyKey: `stale-${randomUUID()}`,
      attempts: 1,
      maxAttempts: 5,
    });

    const latest = engine.getAutomationHistory(tenantId, {
      limit: 1,
      offset: 0,
      automationId: automation.id,
    });
    expect(latest.data[0].status).toBe("skipped");
  });

  it("bumps the automation version when the definition changes", async () => {
    const automation = await storage.createAutomation({
      tenantId,
      title: "Versionada",
      description: "Muda de canal",
      icon: "mail",
      isActive: true,
      triggerType: "order.created",
      actionType: "notify_customer",
      actionChannel: "email",
    });
    expect(automation.version).toBe(1);

    const renamed = await storage.updateAutomation(tenantId, automation.id, {
      title: "Versionada (renomeada)",
    });
    expect(renamed?.version).toBe(1);

    const rechanneled = await storage.updateAutomation(tenantId, automation.id, {
      actionChannel: "sms",
    });
    expect(rechanneled?.version).toBe(2);

    // Another tenant cannot touch the definition.
    expect(
      await storage.updateAutomation(otherTenantId, automation.id, { actionChannel: "whatsapp" }),
    ).toBeUndefined();
  });

  it("keeps automation history scoped to the tenant that owns the automation", () => {
    const tenantHistory = engine.getAutomationHistory(tenantId, { limit: 100, offset: 0 });
    const foreignHistory = engine.getAutomationHistory(otherTenantId, { limit: 100, offset: 0 });
    expect(tenantHistory.total).toBeGreaterThan(0);
    expect(foreignHistory.total).toBe(0);
  });
});
