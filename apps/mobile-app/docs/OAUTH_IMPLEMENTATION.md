# OAuth Implementation Guide

This document explains the OAuth authentication implementation in the Frederick mobile app, which follows Expo's best practices for authentication.

## Overview

The app supports OAuth authentication with Google and Facebook providers using the `expo-auth-session` library. The implementation includes both a class-based service and React hooks for different use cases.

## Architecture

### 1. OAuthService (Class-based)

- **File**: `services/OAuthService.ts`
- **Use case**: Non-React contexts, utility functions
- **Features**: Manual request creation, direct control over auth flow

### 2. OAuth Hooks (React-based)

- **File**: `hooks/useOAuth.ts`
- **Use case**: React components
- **Features**: Uses `useAuthRequest` hook, automatic response handling

## Key Features

### ✅ Expo Best Practices Implemented

1. **WebBrowser.maybeCompleteAuthSession()**

   - Called at the top level to dismiss web popups
   - Required for all authentication providers

2. **Proper Redirect URI Handling**

   - Uses `AuthSession.makeRedirectUri()` for universal platform support
   - Handles both Expo Go and standalone builds correctly
   - Matches the scheme defined in `app.config.ts`

3. **Authorization Code Flow with PKCE**

   - Uses `ResponseType.Code` for secure token exchange
   - Implements `CodeChallengeMethod.S256` for PKCE
   - Exchanges authorization codes on the backend (not in client)

4. **Discovery Documents**

   - Uses proper discovery documents for OAuth endpoints
   - Follows OAuth 2.0 and OpenID Connect standards

5. **Environment-based Configuration**
   - Different redirect URIs for Expo Go vs standalone builds
   - Proper environment variable handling

## Configuration

### Environment Variables

```bash
# Google OAuth
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id

# Facebook OAuth
EXPO_PUBLIC_FACEBOOK_CLIENT_ID=your_facebook_client_id

# Backend API
EXPO_PUBLIC_API_URL=your_backend_url
```

### App Configuration

The `app.config.ts` file includes the necessary scheme:

```typescript
export default {
  expo: {
    scheme: "myapp", // Used for OAuth redirects
    // ... other config
  },
};
```

## Usage Examples

### Using OAuth Hooks (Recommended for React Components)

```typescript
import { useGoogleOAuth, useFacebookOAuth } from '../hooks/useOAuth';

function LoginScreen() {
  const { signInWithGoogle, isReady: isGoogleReady, isLoading: isGoogleLoading } = useGoogleOAuth();
  const { signInWithFacebook, isReady: isFacebookReady, isLoading: isFacebookLoading } = useFacebookOAuth();

  const handleGoogleSignIn = async () => {
    try {
      if (!isGoogleReady) return;

      const result = await signInWithGoogle();
      if (result) {
        console.log('Signed in user:', result.user);
        // Handle successful sign-in
      }
    } catch (error) {
      console.error('Google sign-in failed:', error);
    }
  };

  return (
    <View>
      <TouchableOpacity
        onPress={handleGoogleSignIn}
        disabled={!isGoogleReady || isGoogleLoading}
      >
        <Text>{isGoogleLoading ? 'Signing in...' : 'Sign in with Google'}</Text>
      </TouchableOpacity>
    </View>
  );
}
```

### Using OAuthService (For non-React contexts)

```typescript
import { oAuthService } from "../services/OAuthService";

async function handleSignIn() {
  try {
    const result = await oAuthService.signInWithGoogle();
    console.log("Signed in user:", result.user);
  } catch (error) {
    console.error("Sign-in failed:", error);
  }
}
```

## Security Considerations

### ✅ Implemented Security Measures

1. **Authorization Code Flow**

   - Uses authorization codes instead of implicit flow
   - Tokens are exchanged securely on the backend

2. **PKCE (Proof Key for Code Exchange)**

   - Prevents authorization code interception attacks
   - Uses SHA256 code challenge method

3. **Secure Token Storage**

   - Access tokens are stored securely using the API client
   - Refresh tokens are handled properly

4. **Environment Variable Protection**
   - Client secrets are never exposed in the client
   - Only public client IDs are used in the mobile app

### 🔒 Backend Security

The backend handles the secure parts of OAuth:

1. **Token Exchange**

   - Exchanges authorization codes for access tokens
   - Uses client secrets securely

2. **User Creation/Login**
   - Creates or finds users based on OAuth provider data
   - Generates JWT tokens for session management

## Redirect URI Patterns

### Expo Go Development

```
https://auth.expo.io/@username/slug
```

### Standalone/Development Builds

```
myapp://
```

### Web (if applicable)

```
https://yourwebsite.com/auth/callback
```

## Error Handling

The implementation includes comprehensive error handling:

1. **Configuration Errors**

   - Validates client IDs are set
   - Checks for proper environment setup

2. **OAuth Flow Errors**

   - Handles user cancellation
   - Processes OAuth provider errors
   - Manages network failures

3. **Backend Errors**
   - Handles HTTP errors from the backend
   - Processes authentication failures

## Testing

### Development Testing

1. **Expo Go**

   - Use the auth proxy for testing
   - Configure redirect URIs in OAuth provider dashboards

2. **Development Builds**
   - Test with custom scheme redirects
   - Verify deep linking works correctly

### Production Testing

1. **Standalone Builds**

   - Test OAuth flows in production builds
   - Verify redirect URI handling

2. **Error Scenarios**
   - Test with invalid credentials
   - Test network failures
   - Test user cancellation

## Troubleshooting

### Common Issues

1. **"OAuth request not ready"**

   - Check that client IDs are properly configured
   - Verify environment variables are set

2. **Redirect URI mismatch**

   - Ensure redirect URIs match between app and OAuth provider
   - Check scheme configuration in `app.config.ts`

3. **Web popup not closing**
   - Verify `WebBrowser.maybeCompleteAuthSession()` is called
   - Check that it's called at the top level

### Debug Information

The implementation includes extensive logging:

```typescript
console.log("OAuthService initialized with:", {
  googleClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ? "Set" : "Not set",
  redirectUri: config.redirectUri,
  appOwnership: Constants.appOwnership,
});
```

## Migration from Previous Implementation

If you're migrating from a previous OAuth implementation:

1. **Update imports** to use the new hooks or service
2. **Update component usage** to handle the new return types
3. **Test thoroughly** in both Expo Go and standalone builds
4. **Update OAuth provider configurations** if redirect URIs changed

## References

- [Expo Authentication Documentation](https://docs.expo.dev/guides/authentication/)
- [expo-auth-session Documentation](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [OAuth 2.0 Authorization Code Flow](https://tools.ietf.org/html/rfc6749#section-4.1)
- [PKCE Extension](https://tools.ietf.org/html/rfc7636)
