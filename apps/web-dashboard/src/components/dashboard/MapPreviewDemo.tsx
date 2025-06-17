"use client";

import { MapPreview } from "./MapPreview";

// Sample event data for demonstration
const sampleEvents = [
  {
    id: "1",
    title: "Tech Meetup Downtown",
    description: "Join us for an evening of networking and tech talks",
    latitude: 40.7128,
    longitude: -74.006,
    category: "Technology",
    attendees: 45,
    startTime: "2024-01-15T18:00:00Z",
    endTime: "2024-01-15T21:00:00Z",
  },
  {
    id: "2",
    title: "Art Gallery Opening",
    description: "Exhibition featuring local artists",
    latitude: 40.7589,
    longitude: -73.9851,
    category: "Arts",
    attendees: 32,
    startTime: "2024-01-16T19:00:00Z",
    endTime: "2024-01-16T22:00:00Z",
  },
  {
    id: "3",
    title: "Food Festival",
    description: "Taste cuisines from around the world",
    latitude: 40.7505,
    longitude: -73.9934,
    category: "Food",
    attendees: 120,
    startTime: "2024-01-17T12:00:00Z",
    endTime: "2024-01-17T18:00:00Z",
  },
  {
    id: "4",
    title: "Music Concert",
    description: "Live performance by local bands",
    latitude: 40.7829,
    longitude: -73.9654,
    category: "Music",
    attendees: 85,
    startTime: "2024-01-18T20:00:00Z",
    endTime: "2024-01-18T23:00:00Z",
  },
];

export function MapPreviewDemo() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Map Preview</h2>
        <p className="text-gray-600">
          Interactive map showing event locations with detailed information on
          click.
        </p>
      </div>

      <MapPreview events={sampleEvents} />

      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Setup Instructions</h3>
        <ol className="text-sm text-blue-800 space-y-1">
          <li>
            1. Install dependencies:{" "}
            <code className="bg-blue-100 px-1 rounded">
              npm install mapbox-gl @types/mapbox-gl
            </code>
          </li>
          <li>
            2. Add your Mapbox token to{" "}
            <code className="bg-blue-100 px-1 rounded">.env.local</code>:{" "}
            <code className="bg-blue-100 px-1 rounded">
              NEXT_PUBLIC_MAPBOX_TOKEN=your_token_here
            </code>
          </li>
          <li>
            3. The component will automatically display events with markers and
            popups
          </li>
        </ol>
      </div>
    </div>
  );
}
