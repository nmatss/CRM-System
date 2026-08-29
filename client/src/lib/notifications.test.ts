import { describe, expect, it } from "vitest";
import {
  countUnreadNotifications,
  formatNotificationDate,
  parseNotificationsResponse,
} from "./notifications";

describe("notifications helpers", () => {
  it("accepts the notifications endpoint contract", () => {
    const response = [
      {
        id: 1,
        title: "Nova tarefa",
        message: "Uma tarefa foi atribuída a você.",
        status: "sent",
        createdAt: "2026-08-29T12:00:00.000Z",
        tenantId: 4,
        userId: "user-1",
        type: "task",
        channel: "in_app",
      },
    ];

    expect(parseNotificationsResponse(response)).toEqual(response);
  });

  it("rejects a malformed endpoint response", () => {
    expect(() => parseNotificationsResponse({ data: [] })).toThrow(
      "Resposta de notificações inválida",
    );
    expect(() => parseNotificationsResponse([{ id: 1, title: "Incompleta" }])).toThrow(
      "Resposta de notificações inválida",
    );
  });

  it("counts every notification not marked as read", () => {
    const notifications = parseNotificationsResponse([
      { id: 1, title: "A", message: "A", status: "sent", createdAt: null },
      { id: 2, title: "B", message: "B", status: "read", createdAt: null },
      { id: 3, title: "C", message: "C", status: "PENDING", createdAt: null },
    ]);

    expect(countUnreadNotifications(notifications)).toBe(2);
  });

  it("provides a fallback for missing or invalid dates", () => {
    expect(formatNotificationDate(null)).toBe("Data indisponível");
    expect(formatNotificationDate("invalid-date")).toBe("Data indisponível");
  });
});
