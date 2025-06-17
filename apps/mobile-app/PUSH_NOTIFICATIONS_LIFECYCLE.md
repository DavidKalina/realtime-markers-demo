# Push Notifications Lifecycle Management

This document explains the complete push notification lifecycle management system implemented in the mobile app.

## Overview

The push notification system consists of several components that work together to provide a seamless experience:

1. **Backend API** - Handles token registration, storage, and sending notifications
2. **Mobile Service** - Manages device tokens and permissions
3. **React Hook** - Integrates with app lifecycle and authentication
4. **Test Component** - Provides UI for testing and debugging

## Architecture

### Backend Components

- **`pushNotificationHandlers.ts`** - Extracted handlers for all push notification operations
- **`pushNotifications.ts`** - Clean routes file that focuses on routing
- **API Module** - TypeScript module for mobile app API calls

### Mobile Components

- **`PushNotificationService.ts`** - Core service managing device tokens and permissions
- **`usePushNotifications.ts`** - React hook for lifecycle integration
- **`PushNotificationTest.tsx`** - UI component for testing functionality

## Lifecycle Flow

### 1. App Startup

```typescript
// In _layout.tsx
usePushNotifications(); // Automatically initializes the service
```

**What happens:**

- Service requests notification permissions
- Gets Expo push token from device
- Sets up notification listeners
- Marks service as initialized

### 2. User Authentication

```typescript
// Automatically handled by usePushNotifications hook
if (isAuthenticated && user && isInitialized) {
  await registerToken(); // Registers token with backend
}
```

**What happens:**

- Detects user login
- Registers current device token with backend
- Associates token with user account

### 3. User Logout

```typescript
// Automatically handled by usePushNotifications hook
if (!isAuthenticated && isInitialized) {
  await unregisterToken(); // Removes token from backend
}
```

**What happens:**

- Detects user logout
- Unregisters device token from backend
- Clears local token reference

### 4. Notification Reception

```typescript
// Handled by PushNotificationService
Notifications.addNotificationReceivedListener((notification) => {
  // Handle foreground notifications
});

Notifications.addNotificationResponseReceivedListener((response) => {
  // Handle notification taps
  handleNotificationResponse(response);
});
```

## Usage Examples

### Basic Usage

The system is designed to work automatically. Just add the hook to your app:

```typescript
import { usePushNotifications } from '@/hooks/usePushNotifications';

function App() {
  usePushNotifications(); // That's it!
  return <YourApp />;
}
```

### Manual Token Management

```typescript
const {
  registerToken,
  unregisterToken,
  sendTestNotification,
  hasRegisteredTokens,
} = usePushNotifications();

// Register token manually
await registerToken();

// Check if user has tokens
const hasTokens = await hasRegisteredTokens();

// Send test notification
await sendTestNotification("Hello", "This is a test");
```

### Testing Notifications

```typescript
import { PushNotificationTest } from '@/components/PushNotificationTest';

function TestScreen() {
  return (
    <View>
      <PushNotificationTest />
    </View>
  );
}
```

## API Endpoints

### Register Token

```http
POST /api/push-notifications/register
{
  "token": "ExponentPushToken[...]",
  "deviceType": "IOS",
  "deviceId": "iPhone14,2",
  "appVersion": "1.0.0",
  "osVersion": "17.0"
}
```

### Unregister Token

```http
DELETE /api/push-notifications/unregister
{
  "token": "ExponentPushToken[...]"
}
```

### Get User Tokens

```http
GET /api/push-notifications/tokens
```

### Send Test Notification

```http
POST /api/push-notifications/test
{
  "title": "Test Title",
  "body": "Test Message",
  "data": { "type": "test" }
}
```

### Send to Multiple Users (Admin)

```http
POST /api/push-notifications/send
{
  "userIds": ["user1", "user2"],
  "title": "Group Notification",
  "body": "Message for multiple users",
  "data": { "type": "group" }
}
```

## Configuration

### Notification Handler

```typescript
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});
```

### Device Information

The system automatically detects:

- **Device Type**: iOS, Android, or Web
- **Device ID**: Device name/model
- **App Version**: From Expo config
- **OS Version**: From device info

## Error Handling

### Common Issues

1. **Permission Denied**

   - User denied notification permissions
   - Handle gracefully, show settings prompt

2. **Token Registration Failed**

   - Network issues or backend errors
   - Retry logic built into the service

3. **Invalid Token**
   - Token format issues
   - Automatic cleanup on backend

### Debugging

Use the `PushNotificationTest` component to:

- Check service initialization status
- Verify permission status
- View current token
- Test notification sending
- Check registered tokens

## Best Practices

### 1. Initialize Early

Always initialize the push notification service early in the app lifecycle (in `_layout.tsx`).

### 2. Handle Permissions Gracefully

Don't force users to enable notifications. Provide clear explanations of benefits.

### 3. Test on Physical Devices

Push notifications only work on physical devices, not simulators.

### 4. Monitor Token Status

Regularly check if tokens are still valid and registered.

### 5. Clean Up on Logout

Always unregister tokens when users log out to prevent unwanted notifications.

## Security Considerations

1. **Token Storage**: Tokens are stored securely on the backend
2. **Authentication**: All operations require valid authentication
3. **Admin Access**: Sending to multiple users requires admin role
4. **Token Validation**: Backend validates token format and authenticity

## Troubleshooting

### Token Not Registering

1. Check if user is authenticated
2. Verify notification permissions
3. Check network connectivity
4. Review backend logs

### Notifications Not Received

1. Verify token is registered
2. Check device notification settings
3. Ensure app is not in foreground (for some notification types)
4. Test with Expo's push notification tool

### Permission Issues

1. Guide user to device settings
2. Explain notification benefits
3. Provide alternative notification methods

## Future Enhancements

1. **Rich Notifications**: Support for images and actions
2. **Scheduled Notifications**: Send notifications at specific times
3. **Notification Categories**: Organize notifications by type
4. **Analytics**: Track notification engagement
5. **A/B Testing**: Test different notification strategies
