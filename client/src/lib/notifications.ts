export interface HeaderNotification {
  id: number;
  title: string;
  message: string;
  status: string;
  createdAt: string | null;
}

function isHeaderNotification(value: unknown): value is HeaderNotification {
  if (!value || typeof value !== "object") {
    return false;
  }

  const notification = value as Record<string, unknown>;
  return (
    typeof notification.id === "number" &&
    typeof notification.title === "string" &&
    typeof notification.message === "string" &&
    typeof notification.status === "string" &&
    (typeof notification.createdAt === "string" || notification.createdAt === null)
  );
}

export function parseNotificationsResponse(value: unknown): HeaderNotification[] {
  if (!Array.isArray(value) || !value.every(isHeaderNotification)) {
    throw new Error("Resposta de notificações inválida");
  }

  return value;
}

export function countUnreadNotifications(notifications: HeaderNotification[]): number {
  return notifications.filter((notification) => notification.status.toLowerCase() !== "read")
    .length;
}

export function formatNotificationDate(value: string | null): string {
  if (!value) {
    return "Data indisponível";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Data indisponível";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
