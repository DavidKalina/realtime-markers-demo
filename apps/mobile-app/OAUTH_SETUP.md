# OAuth Setup Guide for Mobile App

This guide will help you set up OAuth authentication with Google and Apple Sign-In for your mobile app.

## Environment Variables

Add the following environment variables to your `.env` file:

```bash
# OAuth Configuration
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id_here
EXPO_PUBLIC_APPLE_CLIENT_ID=your_apple_client_id_here
```

## Backend Environment Variables

Add these to your backend `.env` file:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# Apple OAuth
APPLE_CLIENT_ID=your_apple_client_id_here
APPLE_CLIENT_SECRET=your_apple_client_secret_here
```

## Google OAuth Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to "Credentials" and create an OAuth 2.0 Client ID
5. Set the application type to "Web application"
6. Add authorized redirect URIs:
   - For development: `http://localhost:8081/oauth/google`
   - For production: `https://your-domain.com/oauth/google`
7. Copy the Client ID and Client Secret

## Apple Sign-In Setup

1. Go to [Apple Developer Console](https://developer.apple.com/)
2. Create a new App ID or select an existing one
3. Enable "Sign In with Apple" capability
4. Create a Services ID for your app
5. Configure the Services ID with your domain and redirect URI
6. Create a private key for the Services ID
7. Copy the Client ID and generate the Client Secret using the private key

## App Configuration

### iOS Configuration

For iOS, you need to configure your app's URL scheme. Add this to your `app.json`:

```json
{
  "expo": {
    "scheme": "realtime-markers-demo",
    "ios": {
      "bundleIdentifier": "com.yourcompany.realtimemarkersdemo"
    }
  }
}
```

### Android Configuration

For Android, the URL scheme is automatically configured based on your app's package name.

## Testing

1. Start your backend server
2. Start your mobile app
3. Try signing in with Google or Apple
4. Check the backend logs for any errors

## Troubleshooting

### Common Issues

1. **Redirect URI mismatch**: Make sure the redirect URI in your OAuth provider matches exactly what your app is using
2. **Client ID not found**: Verify that your environment variables are correctly set
3. **Network errors**: Ensure your backend is running and accessible

### Debug Mode

Enable debug logging by setting:

```bash
EXPO_PUBLIC_DEBUG_OAUTH=true
```

This will log OAuth flow details to help with troubleshooting.

## Security Notes

- Never commit your OAuth secrets to version control
- Use different OAuth credentials for development and production
- Regularly rotate your OAuth secrets
- Implement proper error handling for OAuth failures
