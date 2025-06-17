# MapPreview Component Setup

This guide explains how to set up the MapPreview component with Mapbox integration.

## Prerequisites

1. A Mapbox account and access token
2. Node.js and npm/yarn installed

## Installation

1. Install the required dependencies:

```bash
npm install mapbox-gl @types/mapbox-gl
```

2. Add your Mapbox access token to your environment variables:
   - Create a `.env.local` file in the root of your web-dashboard app
   - Add the following line:
   ```
   NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_access_token_here
   ```

## Getting a Mapbox Access Token

1. Go to [Mapbox](https://www.mapbox.com/) and create an account
2. Navigate to your account dashboard
3. Create a new access token or use the default public token
4. Copy the token and add it to your `.env.local` file

## Usage

The MapPreview component is now available and can be used in your dashboard:

```tsx
import { MapPreview } from "@/components/dashboard/MapPreview";

// Sample event data
const events = [
  {
    id: "1",
    title: "Event Title",
    description: "Event description",
    latitude: 40.7128,
    longitude: -74.006,
    category: "Category",
    attendees: 50,
    startTime: "2024-01-15T18:00:00Z",
    endTime: "2024-01-15T21:00:00Z",
  },
];

// Use the component
<MapPreview events={events} />;
```

## Features

- Interactive map with event markers
- Click markers to see event details
- Automatic map bounds fitting to show all events
- Responsive design
- Popup information for each event
- Empty state when no events are provided

## Customization

You can customize the map by modifying the MapPreview component:

- Change the map style by updating the `style` property
- Adjust marker appearance by modifying the marker element styles
- Customize popup content and styling
- Modify the default center coordinates and zoom level

## Troubleshooting

- If the map doesn't load, check that your Mapbox token is correctly set in the environment variables
- Ensure the token has the necessary permissions for map tiles and geocoding
- Check the browser console for any JavaScript errors
- Verify that the `mapbox-gl` CSS is being imported correctly
