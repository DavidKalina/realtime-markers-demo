# Push Notifications Implementation

This document describes the push notification system implemented using Expo's push notification service.

## Overview

The push notification system allows the application to send real-time notifications to users' mobile devices. It uses Expo's push notification service and includes token management, notification sending, and administrative features.

## Architecture

### Components

1. **UserPushToken Entity** - Database entity for storing push tokens
2. **PushNotificationService** - Core service for managing tokens and sending notifications
3. **Push Notification Routes** - API endpoints for token management and sending notifications
4. **Push Notification Handlers** - Request handlers for the API endpoints

### Database Schema

The `user_push_tokens` table stores:

- `id` - Unique identifier (UUID)
- `user_id` - Foreign key to users table
- `token` - Expo push token
- `device_info` - JSONB field for device information
- `created_at` - Token creation timestamp
- `last_used_at` - Last usage timestamp
- `is_active` - Whether the token is active
- `updated_at` - Last update timestamp

## API Endpoints

### User Endpoints (Authentication Required)

#### Register Push Token

```http
POST /api/push-notifications/register
Content-Type: application/json

{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "deviceInfo": {
    "platform": "ios",
    "version": "1.0.0",
    "model": "iPhone 14",
    "osVersion": "16.0"
  }
}
```

#### Unregister Push Token

```http
DELETE /api/push-notifications/unregister
Content-Type: application/json

{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}
```

#### Get User Tokens

```http
GET /api/push-notifications/tokens
```

### Admin Endpoints (Admin Role Required)

#### Send Notification to User

```http
POST /api/push-notifications/send
Content-Type: application/json

{
  "userId": "user-uuid",
  "title": "Notification Title",
  "body": "Notification message",
  "data": { "custom": "data" },
  "sound": "default",
  "badge": 1,
  "priority": "high"
}
```

#### Send Notification to Multiple Users

```http
POST /api/push-notifications/send-to-users
Content-Type: application/json

{
  "userIds": ["user-uuid-1", "user-uuid-2"],
  "title": "Notification Title",
  "body": "Notification message",
  "data": { "custom": "data" }
}
```

#### Get Statistics

```http
GET /api/push-notifications/stats
```

#### Cleanup Invalid Tokens

```http
POST /api/push-notifications/cleanup
```

## Usage Examples

### Registering a Token

```typescript
import { pushNotificationService } from "./services/PushNotificationService";

// Register a token for a user
const userToken = await pushNotificationService.registerToken(
  userId,
  expoPushToken,
  {
    platform: "ios",
    version: "1.0.0",
    model: "iPhone 14",
  },
);
```

### Sending Notifications

```typescript
// Send to a specific user
const result = await pushNotificationService.sendToUser(userId, {
  title: "New Event",
  body: "A new event has been created in your area!",
  data: { eventId: "event-uuid" },
  sound: "default",
  priority: "high",
});

// Send to multiple users
const result = await pushNotificationService.sendToUsers(userIds, {
  title: "System Update",
  body: "The app has been updated with new features!",
  data: { updateVersion: "2.0.0" },
});
```

### Getting Statistics

```typescript
const stats = await pushNotificationService.getStats();
console.log(`Total tokens: ${stats.totalTokens}`);
console.log(`Active tokens: ${stats.activeTokens}`);
console.log(`Users with tokens: ${stats.usersWithTokens}`);
```

## Notification Payload Options

The notification payload supports the following options:

- `title` - Notification title (required)
- `body` - Notification message (required)
- `data` - Custom data object
- `sound` - Sound to play ("default" or null)
- `badge` - Badge number for iOS
- `channelId` - Android notification channel ID
- `categoryId` - iOS notification category
- `mutableContent` - Whether content can be modified
- `priority` - Notification priority ("default", "normal", "high")
- `subtitle` - iOS notification subtitle
- `ttl` - Time to live in seconds

## Device Information

The `deviceInfo` object can include:

- `platform` - Device platform ("ios", "android", "web")
- `version` - App version
- `model` - Device model
- `osVersion` - Operating system version
- `appVersion` - Application version
- Additional custom fields

## Error Handling

The service includes comprehensive error handling:

- Invalid tokens are automatically filtered out
- Failed notifications are logged with error details
- Database errors are caught and logged
- Rate limiting is applied to prevent abuse

## Testing

Run the test script to verify the implementation:

```bash
bun run test:push
```

This will test:

- Database connectivity
- Statistics retrieval
- Token cleanup
- Token validation
- Notification sending (with invalid tokens)

## Security Considerations

1. **Authentication Required** - All endpoints require valid authentication
2. **Admin Access** - Sending notifications requires admin role
3. **Rate Limiting** - Endpoints are rate-limited to prevent abuse
4. **Token Validation** - Invalid tokens are automatically filtered
5. **User Isolation** - Users can only access their own tokens

## Monitoring and Maintenance

### Regular Tasks

1. **Token Cleanup** - Run cleanup periodically to remove invalid tokens
2. **Statistics Monitoring** - Monitor token registration and usage statistics
3. **Error Logging** - Review failed notification attempts
4. **Performance Monitoring** - Monitor notification delivery rates

### Metrics to Track

- Total registered tokens
- Active tokens per user
- Notification delivery success rate
- Failed notification reasons
- Token registration trends

## Integration with Mobile App

The mobile app should:

1. Request push notification permissions
2. Get the Expo push token
3. Register the token with the backend
4. Handle incoming notifications
5. Unregister tokens when appropriate

## Troubleshooting

### Common Issues

1. **Invalid Tokens** - Check token format and validity
2. **Delivery Failures** - Review Expo service status
3. **Database Errors** - Check database connectivity
4. **Rate Limiting** - Monitor request frequency

### Debug Commands

```bash
# Test the service
bun run test:push

# Check database migration
bun run migration:run

# View logs for push notification errors
grep "push notification" logs/app.log
```

## Future Enhancements

1. **Scheduled Notifications** - Support for delayed notifications
2. **Notification Templates** - Predefined notification formats
3. **User Preferences** - Allow users to control notification types
4. **Analytics** - Detailed notification engagement tracking
5. **A/B Testing** - Test different notification strategies
