export interface NotificationPayload {
  tenantId: number;
  userId: string;
  type: string;
  channel: "email" | "sms" | "whatsapp";
  title: string;
  message: string;
  data?: Record<string, any>;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class NotificationService {
  /**
   * Provider integration is not configured yet. Fail closed without logging
   * recipients, message content, tenant data, or invented delivery IDs.
   */
  async sendEmail(_payload: NotificationPayload): Promise<NotificationResult> {
    return {
      success: false,
      error: "Notification provider is not configured",
    };
  }

  /**
   * Send SMS notification when a provider is configured.
   */
  async sendSMS(_payload: NotificationPayload): Promise<NotificationResult> {
    return {
      success: false,
      error: "Notification provider is not configured",
    };
  }

  /**
   * Send WhatsApp notification when a provider is configured.
   */
  async sendWhatsApp(_payload: NotificationPayload): Promise<NotificationResult> {
    return {
      success: false,
      error: "Notification provider is not configured",
    };
  }

  /**
   * Send notification through the appropriate channel
   * Routes to the correct method based on the channel
   */
  async send(payload: NotificationPayload): Promise<NotificationResult> {
    switch (payload.channel) {
      case "email":
        return this.sendEmail(payload);
      case "sms":
        return this.sendSMS(payload);
      case "whatsapp":
        return this.sendWhatsApp(payload);
      default:
        return {
          success: false,
          error: `Unsupported notification channel: ${payload.channel}`,
        };
    }
  }
}

// Export a singleton instance
export const notificationService = new NotificationService();
