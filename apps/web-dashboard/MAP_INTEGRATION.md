# Map Integration Documentation

This document describes the map integration for the web dashboard, which provides real-time event mapping functionality using Mapbox GL JS and WebSocket connections.

## Overview

The map integration consists of several key components:

- **InteractiveMap Component**: Main map component with real-time marker updates
- **WebSocket Integration**: Real-time event updates via WebSocket connection
- **Location Store**: State management for map data and interactions
- **Marker Clustering**: Efficient handling of multiple markers (future enhancement)

## Setup

### 1. Environment Variables

Add the following environment variables to your `.env.local` file:

```bash
# Mapbox access token (required)
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_access_token_here

# WebSocket URL for real-time updates
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:3001
```

### 2. Mapbox Setup

1. Create a Mapbox account at [mapbox.com](https://mapbox.com)
2. Generate an access token
3. Add the token to your environment variables

### 3. Dependencies

The following dependencies are already included in `package.json`:

```json
{
  "mapbox-gl": "^3.13.0",
  "@types/mapbox-gl": "^3.4.1"
}
```

## Components

### InteractiveMap

The main map component located at `src/components/map/InteractiveMap.tsx`.

**Features:**

- Real-time marker updates via WebSocket
- Interactive marker selection
- Popup information display
- Connection status indicator
- Map controls (navigation, fullscreen, reset view)

**Props:**

```typescript
interface InteractiveMapProps {
  className?: string;
  initialCenter?: [number, number]; // [longitude, latitude]
  initialZoom?: number;
  websocketUrl: string;
}
```

### Usage Example

```tsx
import { InteractiveMap } from "@/components/map/InteractiveMap";

function MapPage() {
  return (
    <InteractiveMap
      websocketUrl="ws://localhost:3001"
      initialCenter={[-74.006, 40.7128]} // NYC
      initialZoom={12}
      className="h-[600px]"
    />
  );
}
```

## WebSocket Integration

The map uses WebSocket connections to receive real-time event updates from the backend.

### Message Types

The WebSocket expects the following message types:

- `connection_established`: Initial connection confirmation
- `replace-all`: Full marker replacement
- `add-event`: Add a new event marker
- `update-event`: Update an existing event marker
- `delete-event`: Remove an event marker
- `viewport-update`: Update the current viewport

### Event Format

Events should follow this structure:

```typescript
interface Event {
  id: string;
  location: {
    coordinates: [number, number]; // [longitude, latitude]
  };
  title: string;
  emoji: string;
  color: string;
  description?: string;
  eventDate?: string;
  location?: string;
  categories?: string[];
  isVerified?: boolean;
  isPrivate?: boolean;
  // ... other fields
}
```

## State Management

The map uses Zustand for state management through the `useLocationStore` hook.

### Key State

```typescript
interface LocationStoreState {
  markers: Marker[];
  selectedItem: MapItem | null;
  zoomLevel: number;
  // ... other state
}
```

### Store Actions

- `setMarkers(markers)`: Update all markers
- `selectMapItem(item)`: Select a marker or cluster
- `setZoomLevel(zoom)`: Update zoom level
- `updateViewport(viewport)`: Update current viewport

## Utilities

Map utilities are available in `src/utils/mapUtils.ts`:

- `calculateDistance()`: Calculate distance between coordinates
- `formatDistance()`: Format distance for display
- `getCurrentLocation()`: Get user's current location
- `calculateBounds()`: Calculate map bounds
- `generateMarkerColor()`: Generate random marker colors
- `formatEventDate()`: Format event dates

## Styling

The map component uses Tailwind CSS for styling. Key classes:

- `.map-marker`: Base marker styling
- `.marker-popup`: Popup styling
- `.cluster-marker`: Cluster marker styling (future)

## Customization

### Marker Styling

Customize marker appearance by modifying the `createMarkerElement` function in `InteractiveMap.tsx`:

```typescript
const createMarkerElement = useCallback((marker: any) => {
  const el = document.createElement("div");
  // Custom styling here
  el.style.backgroundColor = marker.data.color || "#ef4444";
  el.style.borderRadius = "50%";
  // ... more styling
  return el;
}, []);
```

### Popup Content

Customize popup content by modifying the `createPopupContent` function:

```typescript
const createPopupContent = useCallback((marker: any) => {
  const data = marker.data;
  return `
    <div class="custom-popup">
      <h3>${data.title}</h3>
      <p>${data.description}</p>
      <!-- Custom content -->
    </div>
  `;
}, []);
```

## Troubleshooting

### Common Issues

1. **Map not loading**: Check Mapbox token and network connectivity
2. **No markers appearing**: Verify WebSocket connection and event format
3. **TypeScript errors**: Ensure all dependencies are properly installed

### Debug Mode

Enable debug logging by checking the browser console for:

- WebSocket connection status
- Marker update events
- Map interaction events

### Performance

For large numbers of markers:

1. Consider implementing marker clustering
2. Use viewport-based filtering
3. Implement marker culling for off-screen markers

## Future Enhancements

- [ ] Marker clustering for better performance
- [ ] Custom map styles
- [ ] Advanced filtering options
- [ ] Marker animations
- [ ] Offline map support
- [ ] Location-based services integration

## API Reference

### InteractiveMap Props

| Prop            | Type               | Default              | Description                         |
| --------------- | ------------------ | -------------------- | ----------------------------------- |
| `className`     | `string`           | `""`                 | CSS classes for styling             |
| `initialCenter` | `[number, number]` | `[-74.006, 40.7128]` | Initial map center                  |
| `initialZoom`   | `number`           | `12`                 | Initial zoom level                  |
| `websocketUrl`  | `string`           | -                    | WebSocket URL for real-time updates |

### Store Actions

| Action           | Parameters                 | Description            |
| ---------------- | -------------------------- | ---------------------- |
| `setMarkers`     | `markers: Marker[]`        | Update all markers     |
| `selectMapItem`  | `item: MapItem \| null`    | Select/deselect marker |
| `setZoomLevel`   | `zoom: number`             | Update zoom level      |
| `updateViewport` | `viewport: MapboxViewport` | Update viewport bounds |

## Support

For issues or questions about the map integration:

1. Check the browser console for error messages
2. Verify environment variables are set correctly
3. Ensure WebSocket server is running and accessible
4. Review the Mapbox documentation for API changes
