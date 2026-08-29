import { describe, expect, it, vi } from "vitest";
import { NotificationService, type NotificationPayload } from "../services/notifications";

describe("NotificationService without a configured provider", () => {
  it("fails closed for every supported channel without logging PII", async () => {
    const consoleSpies = [
      vi.spyOn(console, "log").mockImplementation(() => undefined),
      vi.spyOn(console, "warn").mockImplementation(() => undefined),
      vi.spyOn(console, "error").mockImplementation(() => undefined),
    ];
    const service = new NotificationService();
    const basePayload = {
      tenantId: 42,
      userId: "private-recipient@example.com",
      type: "account",
      title: "Sensitive subject",
      message: "Sensitive message",
    };

    for (const channel of ["email", "sms", "whatsapp"] as const) {
      const result = await service.send({ ...basePayload, channel } satisfies NotificationPayload);
      expect(result).toEqual({
        success: false,
        error: "Notification provider is not configured",
      });
    }

    consoleSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
    consoleSpies.forEach((spy) => spy.mockRestore());
  });
});
