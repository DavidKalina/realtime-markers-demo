# @realtime-markers/shared

This package contains shared utilities and hooks that are used across the realtime-markers project.

## Installation

This package is automatically available as a workspace dependency in the monorepo. Add it to your app's `package.json`:

```json
{
  "dependencies": {
    "@realtime-markers/shared": "workspace:*"
  }
}
```

## Usage

### useMapWebSocket Hook

The `useMapWebSocket` hook provides WebSocket functionality for real-time map updates. It's designed to be configurable for different client types (mobile, dashboard, etc.).

#### Basic Usage

```typescript
import { useMapWebSocket, UseMapWebSocketConfig } from "@realtime-markers/shared";
import { eventBroker, EventTypes } from "@/services/EventBroker";
import { useLocationStore } from "@/stores/useLocationStore";
import { useAuth } from "@/contexts/AuthContext";

export const useMapWebSocket = (url: string) => {
  const { user, isAuthenticated } = useAuth();

  const config: UseMapWebSocketConfig = {
    clientType: "mobile", // or "dashboard"
    useLocationStore,
    eventBroker,
    EventTypes,
    useAuth: () => ({ user, isAuthenticated }),
  };

  return useMapWebSocket(url, config);
};
```

#### Configuration

The hook requires a configuration object with the following properties:

- `clientType`: The type of client ("mobile" | "dashboard")
- `useLocationStore`: A Zustand store with `setMarkers`, `selectMarker`, and `selectedMarkerId` methods
- `eventBroker`: An event emitter for broadcasting map events
- `EventTypes`: Event type constants
- `useAuth`: A function that returns user authentication state

#### Return Value

The hook returns an object with:

- `markers`: Array of map markers
- `isConnected`: WebSocket connection status
- `error`: Any connection errors
- `currentViewport`: Current map viewport
- `updateViewport`: Function to update the viewport
- `clientId`: WebSocket client ID

## Types

### Marker

```typescript
interface Marker {
  id: string;
  coordinates: [number, number]; // [longitude, latitude]
  data: {
    title: string;
    emoji: string;
    color: string;
    location?: string;
    distance?: string;
    time?: string;
    eventDate?: string;
    endDate?: string;
    description?: string;
    categories?: string[];
    isVerified?: boolean;
    created_at?: string;
    updated_at?: string;
    isPrivate?: boolean;
    status?: string;
    [key: string]: any;
  };
}
```

### MapboxViewport

```typescript
interface MapboxViewport {
  north: number;
  south: number;
  east: number;
  west: number;
}
```

## Development

To build the package:

```bash
cd packages/shared
pnpm build
```

To watch for changes during development:

```bash
cd packages/shared
pnpm dev
```
