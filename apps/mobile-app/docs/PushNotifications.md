# Mobile App Push Notifications

This document describes how push notifications are integrated into the mobile app using Expo's notification system.

## Overview

The mobile app automatically sets up push notifications when users authenticate. The system handles:

- Permission requests
- Token registration with the backend
- Notification listeners
- Device information collection

## Architecture

### Components

1. **PushNotificationService** - Core service for managing notifications
2. **PushNotificationsModule** - API client module for backend communication
3. **AuthContext Integration** - Automatic setup after authentication
4. **usePushNotifications Hook** - Sets up notification listeners

### Flow

1. User authenticates (login, register, OAuth)
2. AuthContext automatically calls `setupPushNotifications(userId)`
3. Service requests notification permissions
4. If granted, gets Expo push token
5. Registers token with backend via API
6. Sets up notification listeners for incoming notifications

## Setup

### Automatic Setup

Push notifications are automatically set up in the following scenarios:

- User login
- User registration
- OAuth authentication (Google, Facebook)
- Token refresh
- App initialization (if user is already authenticated)

### Manual Setup

If you need to manually trigger push notification setup:

```typescript
import { pushNotificationService } from "@/services/PushNotificationService";

// Setup for a specific user
const success = await pushNotificationService.setupPushNotifications(userId);
```

## API Integration

### Token Registration

The app automatically registers push tokens with the backend:

```typescript
// This happens automatically in AuthContext
await apiClient.pushNotifications.registerToken(token, deviceInfo);
```

### Device Information

The app collects and sends device information:

- Platform (iOS/Android/Web)
- Device model
- OS version
- App version

## Notification Handling

### Listeners Setup

Notification listeners are automatically set up in the app layout:

```typescript
// In _layout.tsx
function AppContent({ children }: AppContentProps) {
  usePushNotifications(); // Sets up listeners
  // ...
}
```

### Notification Types

The app can handle different types of notifications:

```typescript
// In PushNotificationService.ts
private handleNotificationResponse(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data;

  if (data?.type === "event") {
    // Navigate to event details
    console.log("Navigate to event:", data.eventId);
  } else if (data?.type === "civic_engagement") {
    // Navigate to civic engagement details
    console.log("Navigate to civic engagement:", data.engagementId);
  }
}
```

## Testing

### Local Notifications

Use the test hook for development:

```typescript
import { useTestNotifications } from "@/hooks/usePushNotifications";

function TestComponent() {
  const { testLocalNotification, checkPermissions } = useTestNotifications();

  return (
    <View>
      <Button onPress={testLocalNotification} title="Test Notification" />
      <Button onPress={checkPermissions} title="Check Permissions" />
    </View>
  );
}
```

### Backend Testing

Test sending notifications from the backend:

```bash
# Test the backend service
bun run test:push
```

## Configuration

### Environment Variables

Make sure these are set in your environment:

```env
EXPO_PUBLIC_API_URL=your-backend-url
# EXPO_PUBLIC_PROJECT_ID is optional - only needed for development builds or custom servers
EXPO_PUBLIC_PROJECT_ID=your-expo-project-id
```

**Note:** `EXPO_PUBLIC_PROJECT_ID` is only required in specific scenarios:

- Development builds (when using `expo run:ios` or `expo run:android`)
- Custom development servers
- When you need to specify a different project than the one in your app config

For most cases (Expo Go, standard builds), this environment variable is not needed.

### Expo Configuration

Ensure your `app.json` or `app.config.js` includes:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#ffffff",
          "sounds": ["./assets/notification-sound.wav"]
        }
      ]
    ]
  }
}
```

## Permissions

### iOS

For iOS, add to your `app.json`:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"]
      }
    }
  }
}
```

### Android

For Android, the necessary permissions are automatically added by expo-notifications.

## Troubleshooting

### Common Issues

1. **Permissions Denied**

   - Check if user denied permissions
   - Guide user to Settings to enable notifications

2. **Token Registration Fails**

   - Check network connectivity
   - Verify backend API is running
   - Check authentication state

3. **Notifications Not Received**
   - Verify token is registered with backend
   - Check Expo project configuration
   - Test with local notifications first

### Debug Commands

```typescript
// Check notification permissions
const permissions = await pushNotificationService.getNotificationPermissions();
console.log("Permissions:", permissions);

// Get user tokens
const tokens = await pushNotificationService.getUserTokens();
console.log("User tokens:", tokens);

// Test local notification
await pushNotificationService.scheduleLocalNotification(
  "Test",
  "This is a test",
  { type: "test" },
);
```

## Security Considerations

1. **Token Storage** - Tokens are stored securely on the backend
2. **Authentication** - All API calls require valid authentication
3. **User Isolation** - Users can only access their own tokens
4. **Permission Handling** - App respects user permission choices

## Future Enhancements

1. **Notification Preferences** - Allow users to control notification types
2. **Rich Notifications** - Support for images and actions
3. **Scheduled Notifications** - Local notification scheduling
4. **Notification History** - Track notification interactions
5. **A/B Testing** - Test different notification strategies
