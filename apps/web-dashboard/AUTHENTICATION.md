# Authentication System

This document describes the authentication system implemented in the web dashboard.

## Overview

The web dashboard uses a secure JWT-based authentication system that communicates with the backend API. The system includes:

- **Token Management**: Secure storage and automatic refresh of JWT tokens
- **Protected Routes**: Middleware and components to guard authenticated routes
- **Authentication Context**: Global state management for user authentication
- **API Client**: Automatic token injection and refresh for API requests

## Architecture

### 1. Token Storage

Tokens are stored in `sessionStorage` for the current browser session:

- `auth_access_token`: JWT access token
- `auth_refresh_token`: JWT refresh token
- `auth_user`: Serialized user object

**Security Notes:**

- Tokens are cleared when the browser closes
- No tokens are stored in localStorage (persistent storage)
- For production, consider using httpOnly cookies for additional security

### 2. Authentication Flow

1. **Login/Register**: User submits credentials → Backend validates → Returns JWT tokens
2. **Token Storage**: Tokens stored in sessionStorage
3. **API Requests**: Access token automatically included in Authorization header
4. **Token Refresh**: When access token expires, refresh token used to get new access token
5. **Logout**: Tokens cleared from storage, backend notified

### 3. Protected Routes

Two levels of protection:

1. **Middleware** (`src/middleware.ts`): Server-side route protection
2. **ProtectedRoute Component**: Client-side component wrapper

## Usage

### Setting up Authentication

1. **Environment Variables**: Create `.env.local` file:

   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

2. **AuthProvider**: Already configured in `src/app/layout.tsx`

### Using Authentication in Components

```tsx
import { useAuth } from "@/contexts/AuthContext";

function MyComponent() {
  const { user, isAuthenticated, login, logout } = useAuth();

  if (!isAuthenticated) {
    return <div>Please log in</div>;
  }

  return (
    <div>
      <p>Welcome, {user?.displayName}!</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### Protecting Routes

```tsx
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function ProtectedPage() {
  return (
    <ProtectedRoute>
      <div>This content is only visible to authenticated users</div>
    </ProtectedRoute>
  );
}
```

### Making Authenticated API Requests

```tsx
import { api } from "@/lib/api";

// Automatic token injection and refresh
const data = await api.get("/some-protected-endpoint");
const result = await api.post("/create-something", { name: "test" });
```

## API Endpoints

The authentication system communicates with these backend endpoints:

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/refresh-token` - Refresh access token
- `POST /api/auth/logout` - User logout
- `POST /api/auth/me` - Get current user

## Security Features

1. **Automatic Token Refresh**: Handles expired tokens transparently
2. **Session-based Storage**: Tokens cleared on browser close
3. **Route Protection**: Multiple layers of authentication checks
4. **Error Handling**: Graceful handling of authentication failures
5. **Type Safety**: Full TypeScript support for all auth operations

## Development

### Testing Authentication

1. Start the backend server (should be running on port 3001)
2. Start the web dashboard: `npm run dev`
3. Navigate to `/login` to test authentication
4. Try accessing protected routes without authentication

### Debugging

- Check browser DevTools → Application → Session Storage for tokens
- Monitor Network tab for API requests
- Check browser console for authentication errors

## Production Considerations

1. **HTTPS**: Ensure all communication uses HTTPS
2. **Cookie Security**: Consider using httpOnly cookies for token storage
3. **CORS**: Configure proper CORS settings on backend
4. **Rate Limiting**: Implement rate limiting on auth endpoints
5. **Token Expiration**: Set appropriate token expiration times
6. **Logout**: Ensure proper token invalidation on logout
