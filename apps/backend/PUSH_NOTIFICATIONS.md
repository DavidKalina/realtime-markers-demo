# Push Notification Service

This service provides push notification functionality using Expo's push notification service. It follows the same dependency injection pattern as other services in the codebase.

## Features

- Register and unregister push tokens for users
- Send push notifications to individual users or multiple users
- Automatic token validation and cleanup
- Caching for improved performance
- Support for different device types (iOS, Android, Web)

## API Endpoints

### Register Push Token

```http
POST /api/push-notifications/register
Authorization: Bearer <token>
Content-Type: application/json

{
  "token": "ExponentPushToken[your-token-here]",
  "deviceType": "ios",
  "deviceId": "optional-device-id",
  "appVersion": "1.0.0",
  "osVersion": "15.0"
}
```

### Unregister Push Token

```http
DELETE /api/push-notifications/unregister
Authorization: Bearer <token>
Content-Type: application/json

{
  "token": "ExponentPushToken[your-token-here]"
}
```

### Get User Tokens

```http
GET /api/push-notifications/tokens
Authorization: Bearer <token>
```

### Send Test Notification

```http
POST /api/push-notifications/test
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Test Notification",
  "body": "This is a test notification",
  "data": {
    "customField": "value"
  }
}
```

### Send to Multiple Users (Admin Only)

```http
POST /api/push-notifications/send
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "userIds": ["user-id-1", "user-id-2"],
  "title": "Broadcast Notification",
  "body": "This is a broadcast message",
  "data": {
    "customField": "value"
  }
}
```

## Usage in Code

### Basic Usage

```typescript
import { createPushNotificationService } from "./services/PushNotificationService";
import { createPushNotificationCacheService } from "./services/shared/PushNotificationCacheService";

// Initialize the service
const pushNotificationService = createPushNotificationService({
  dataSource,
  redisService,
  pushNotificationCacheService: createPushNotificationCacheService(redisClient),
});

// Register a token
const pushToken = await pushNotificationService.registerToken(
  userId,
  "ExponentPushToken[token]",
  DeviceType.IOS,
  "device-id",
  "1.0.0",
  "15.0",
);

// Send a notification
const results = await pushNotificationService.sendToUser(userId, {
  title: "Hello!",
  body: "This is a notification",
  data: { customField: "value" },
  sound: "default",
  priority: "high",
});

// Clean up invalid tokens
await pushNotificationService.cleanupInvalidTokens(results);
```

### Notification Data Structure

```typescript
interface PushNotificationData {
  title: string; // Required: Notification title
  body: string; // Required: Notification body
  data?: Record<string, unknown>; // Optional: Custom data
  sound?: "default" | null; // Optional: Sound to play
  badge?: number; // Optional: Badge count
  channelId?: string; // Optional: Android channel ID
  categoryId?: string; // Optional: iOS category ID
  mutableContent?: boolean; // Optional: iOS mutable content
  priority?: "default" | "normal" | "high"; // Optional: Priority
  subtitle?: string; // Optional: iOS subtitle
  ttl?: number; // Optional: Time to live in seconds
}
```

## Device Types

- `ios` - iOS devices
- `android` - Android devices
- `web` - Web browsers

## Token Management

The service automatically:

- Validates tokens using Expo's validation
- Updates existing tokens when re-registered
- Tracks token usage with timestamps
- Deactivates invalid tokens based on push results
- Caches user tokens for improved performance

## Error Handling

The service provides detailed error information:

```typescript
interface PushNotificationResult {
  success: boolean;
  token: string;
  error?: string;
  status?: "ok" | "error";
}
```

## Caching

The service uses Redis caching to improve performance:

- User tokens are cached for 5 minutes
- Push results are cached for 1 hour
- Cache is automatically invalidated when tokens are updated

## Testing

Run the tests with:

```bash
bun test services/__tests__/PushNotificationService.test.ts
```

## Environment Variables

No additional environment variables are required beyond the standard Redis configuration.

## Integration with Notification Service

The push notification service can be integrated with the existing notification service to send both in-app and push notifications:

```typescript
// Send in-app notification
await notificationService.createNotification(
  userId,
  NotificationType.EVENT_RSVP_TOGGLED,
  "New RSVP",
  "Someone RSVP'd to your event",
);

// Send push notification
await pushNotificationService.sendToUser(userId, {
  title: "New RSVP",
  body: "Someone RSVP'd to your event",
  data: { eventId: "event-id" },
});
```
