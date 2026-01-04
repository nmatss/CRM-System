# Notification Service

This directory contains service modules for ZippiCRM.

## NotificationService

The `NotificationService` provides a foundation for sending notifications through multiple channels.

### Usage Example

```typescript
import { notificationService } from './services/notifications';

// Send an email notification
const result = await notificationService.sendEmail({
  tenantId: 1,
  userId: 'user-123',
  type: 'task_reminder',
  channel: 'email',
  title: 'Task Reminder',
  message: 'You have 5 pending tasks to complete today',
  data: { taskCount: 5 }
});

// Send via any channel using the generic send method
await notificationService.send({
  tenantId: 1,
  userId: 'user-456',
  type: 'welcome',
  channel: 'whatsapp', // 'email' | 'sms' | 'whatsapp'
  title: 'Welcome to ZippiCRM',
  message: 'Thank you for joining us!'
});
```

### Current Implementation

All notification methods are **stub implementations** that log what would be sent and return success. This provides the foundation for future integration with real notification providers (SendGrid, Twilio, WhatsApp Business API, etc.).

### Database Integration

Notifications are stored in the database using the `notifications` table:
- `id`: Notification ID
- `tenantId`: Tenant identifier
- `userId`: User identifier
- `type`: Type of notification (e.g., 'task_reminder', 'welcome')
- `channel`: Delivery channel ('email', 'sms', 'whatsapp')
- `title`: Notification title
- `message`: Notification message
- `status`: Status ('pending', 'sent', 'failed')
- `createdAt`: Creation timestamp

### API Endpoint

**GET /api/v1/notifications**
- Returns list of notifications for authenticated user's tenant
- Query params:
  - `userId` (optional): Filter by specific user
  - `limit` (optional): Limit results (default: 50)

Example:
```bash
GET /api/v1/notifications?userId=user-123&limit=20
```

### Future Enhancements

When ready to integrate real notification providers:
1. Add provider configuration (API keys, endpoints)
2. Implement actual email/SMS/WhatsApp sending logic
3. Add error handling and retry mechanisms
4. Update notification status in database after sending
5. Add notification templates
6. Add notification preferences per user
