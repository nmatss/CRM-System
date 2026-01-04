export interface NotificationPayload {
  tenantId: number;
  userId: string;
  type: string;
  channel: 'email' | 'sms' | 'whatsapp';
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
   * Send email notification (stub implementation)
   * Logs the email details and returns success
   */
  async sendEmail(payload: NotificationPayload): Promise<NotificationResult> {
    console.log('[NotificationService] Email would be sent:', {
      to: payload.userId,
      subject: payload.title,
      body: payload.message,
      tenantId: payload.tenantId,
      type: payload.type,
      data: payload.data,
    });

    return {
      success: true,
      messageId: `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  /**
   * Send SMS notification (stub implementation)
   * Logs the SMS details and returns success
   */
  async sendSMS(payload: NotificationPayload): Promise<NotificationResult> {
    console.log('[NotificationService] SMS would be sent:', {
      to: payload.userId,
      message: payload.message,
      tenantId: payload.tenantId,
      type: payload.type,
      data: payload.data,
    });

    return {
      success: true,
      messageId: `sms-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  /**
   * Send WhatsApp notification (stub implementation)
   * Logs the WhatsApp message details and returns success
   */
  async sendWhatsApp(payload: NotificationPayload): Promise<NotificationResult> {
    console.log('[NotificationService] WhatsApp message would be sent:', {
      to: payload.userId,
      message: payload.message,
      tenantId: payload.tenantId,
      type: payload.type,
      data: payload.data,
    });

    return {
      success: true,
      messageId: `whatsapp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  /**
   * Send notification through the appropriate channel
   * Routes to the correct method based on the channel
   */
  async send(payload: NotificationPayload): Promise<NotificationResult> {
    switch (payload.channel) {
      case 'email':
        return this.sendEmail(payload);
      case 'sms':
        return this.sendSMS(payload);
      case 'whatsapp':
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
