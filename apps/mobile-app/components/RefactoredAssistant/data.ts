// data.ts - Updated with new properties
import { EventType } from "./types";

export const eventSuggestions: EventType[] = [
  {
    id: "event-1",
    emoji: "🎸",
    title: "Rock Concert in the Park",
    description:
      "Live music featuring local rock bands with food trucks and activities for all ages.",
    location: "Central Park Amphitheater",
    time: "Saturday, 7:00 PM",
    distance: "1.2 miles away",
    categories: ["Music", "Outdoor", "Food"],
    coordinates: [-73.9665, 40.7812], // Example coordinates for Central Park
    isVerified: true,
    color: "#4dabf7",
    created_at: "2025-02-15T12:00:00Z",
    updated_at: "2025-02-20T14:30:00Z",
  },
  {
    id: "event-2",
    emoji: "🍕",
    title: "Food Truck Festival",
    description: "Sample amazing cuisine from over 25 food trucks with live music and craft beer.",
    location: "Downtown Plaza",
    time: "Sunday, 12:00 PM - 8:00 PM",
    distance: "0.8 miles away",
    categories: ["Food", "Festival", "Family"],
    coordinates: [-73.984, 40.7484], // Example coordinates
    isVerified: true,
    color: "#4dabf7",
    created_at: "2025-02-16T09:15:00Z",
    updated_at: "2025-02-21T10:45:00Z",
  },
  {
    id: "event-3",
    emoji: "🎨",
    title: "Art Gallery Opening",
    description: "Featuring new works from local artists with wine and cheese reception.",
    location: "Modern Art Center",
    time: "Friday, 6:00 PM - 9:00 PM",
    distance: "1.5 miles away",
    categories: ["Art", "Culture", "Drinks"],
    coordinates: [-73.9632, 40.7605], // Example coordinates
    isVerified: true,
    color: "#4dabf7",
    created_at: "2025-02-17T16:20:00Z",
    updated_at: "2025-02-22T11:30:00Z",
  },
  {
    id: "event-4",
    emoji: "🏃",
    title: "Charity 5K Run",
    description: "Annual run supporting children's hospital with prizes and post-race celebration.",
    location: "Riverside Park",
    time: "Saturday, 9:00 AM",
    distance: "2.1 miles away",
    categories: ["Sports", "Charity", "Outdoor"],
    coordinates: [-73.9683, 40.8013], // Example coordinates
    isVerified: false,
    color: "#adb5bd",
    created_at: "2025-02-18T08:00:00Z",
    updated_at: "2025-02-23T09:10:00Z",
  },
];
