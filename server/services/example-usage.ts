/**
 * Example Usage of NotificationService
 *
 * This file demonstrates how to use the notification service in your application.
 * These examples are for reference only and should not be executed directly.
 */

import { notificationService, type NotificationPayload } from "./notifications";
import { storage } from "../storage";

// Example 1: Send a simple email notification
async function sendTaskReminderEmail() {
  const payload: NotificationPayload = {
    tenantId: 1,
    userId: "user-123",
    type: "task_reminder",
    channel: "email",
    title: "Daily Task Reminder",
    message: "You have 5 pending tasks to complete today",
    data: {
      taskCount: 5,
      urgentTasks: 2,
    },
  };

  const result = await notificationService.sendEmail(payload);
  console.log("Email sent:", result);

  // Store the notification in the database
  if (result.success) {
    await storage.createNotification({
      tenantId: payload.tenantId,
      userId: payload.userId,
      type: payload.type,
      channel: payload.channel,
      title: payload.title,
      message: payload.message,
      status: "sent",
    });
  }
}

// Example 2: Send SMS notification
async function sendSMSAlert() {
  const result = await notificationService.sendSMS({
    tenantId: 1,
    userId: "user-456",
    type: "order_shipped",
    channel: "sms",
    title: "Order Shipped",
    message: "Your order #12345 has been shipped and will arrive in 2-3 business days",
    data: {
      orderId: "12345",
      trackingNumber: "TRACK123456",
    },
  });

  console.log("SMS sent:", result);
}

// Example 3: Send WhatsApp notification
async function sendWhatsAppWelcome() {
  const result = await notificationService.sendWhatsApp({
    tenantId: 1,
    userId: "user-789",
    type: "welcome",
    channel: "whatsapp",
    title: "Welcome to ZippiCRM",
    message:
      "Welcome! We are excited to have you on board. Reply to this message if you need any help.",
  });

  console.log("WhatsApp sent:", result);
}

// Example 4: Use the generic send method with dynamic channel
async function sendNotificationToPreferredChannel(
  userId: string,
  preferredChannel: "email" | "sms" | "whatsapp",
) {
  const result = await notificationService.send({
    tenantId: 1,
    userId: userId,
    type: "campaign_update",
    channel: preferredChannel,
    title: "New Campaign Available",
    message: "Check out our latest promotion - 20% off on all products!",
    data: {
      campaignId: "SUMMER2025",
      discount: "20%",
    },
  });

  // Store in database
  await storage.createNotification({
    tenantId: 1,
    userId: userId,
    type: "campaign_update",
    channel: preferredChannel,
    title: "New Campaign Available",
    message: "Check out our latest promotion - 20% off on all products!",
    status: result.success ? "sent" : "failed",
  });

  return result;
}

// Example 5: Batch notifications to multiple users
async function sendBatchNotifications(userIds: string[]) {
  const results = await Promise.all(
    userIds.map((userId) =>
      notificationService.sendEmail({
        tenantId: 1,
        userId: userId,
        type: "weekly_report",
        channel: "email",
        title: "Your Weekly Performance Report",
        message: "Here is your performance summary for this week.",
      }),
    ),
  );

  console.log(`Sent ${results.filter((r) => r.success).length} notifications successfully`);
  return results;
}

// Example 6: Retrieve user notifications from database
async function getUserNotifications(tenantId: number, userId: string) {
  const notifications = await storage.getNotifications(tenantId, userId, 20);
  console.log(`Found ${notifications.length} notifications for user ${userId}`);
  return notifications;
}

// Example 7: Update notification status after processing.
// The tenant and the owner are part of the call on purpose: an id alone must
// never be enough to change someone else's notification.
async function markNotificationAsRead(tenantId: number, userId: string, notificationId: number) {
  const updated = await storage.markNotificationRead(tenantId, userId, notificationId);
  console.log("Notification marked as read:", updated);
  return updated;
}

// Export examples for reference
export {
  sendTaskReminderEmail,
  sendSMSAlert,
  sendWhatsAppWelcome,
  sendNotificationToPreferredChannel,
  sendBatchNotifications,
  getUserNotifications,
  markNotificationAsRead,
};
