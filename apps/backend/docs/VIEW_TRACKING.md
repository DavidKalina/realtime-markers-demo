# Event View Tracking

This document describes the event view tracking functionality that has been added to track when users view events.

## Overview

Event view tracking allows the application to monitor which events are being viewed by users, providing valuable insights into event popularity and user engagement patterns.

## Database Schema

### New Entity: UserEventView

```typescript
@Entity("user_event_views")
@Unique(["userId", "eventId"])
export class UserEventView {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @Column({ name: "event_id", type: "uuid" })
  eventId!: string;

  @ManyToOne(() => User, (user) => user.viewedEvents, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: Relation<User>;

  @ManyToOne(() => Event, (event) => event.views, { onDelete: "CASCADE" })
  @JoinColumn({ name: "event_id" })
  event!: Relation<Event>;

  @Index(["userId", "viewedAt"])
  @CreateDateColumn({ name: "viewed_at", type: "timestamptz" })
  viewedAt!: Date;
}
```

### Updated Entities

#### User Entity

- Added `viewCount` field to track total views by user

#### Event Entity

- Added `viewCount` field to track total views of event

## API Endpoints

### Track Event View

```
POST /api/events/:id/view
```

**Authentication:** Required

**Response:**

```json
{
  "success": true,
  "message": "Event view tracked successfully"
}
```

**Error Responses:**

- `401` - Authentication required
- `400` - Missing event ID
- `404` - Event not found

## Service Layer

### UserEngagementService

The `UserEngagementService` now includes a `createViewRecord` method:

```typescript
async createViewRecord(userId: string, eventId: string): Promise<void>
```

This method:

1. Creates a view record in the database (with deduplication)
2. Increments the user's view count
3. Increments the event's view count
4. Publishes changes to Redis for filter processor updates

### EventService

The `EventService` delegates view tracking to the `UserEngagementService`:

```typescript
async createViewRecord(userId: string, eventId: string) {
  return this.engagementService.createViewRecord(userId, eventId);
}
```

## Mobile App Integration

### API Client

The mobile app's `EventApiClient` includes a `trackEventView` method:

```typescript
async trackEventView(eventId: string): Promise<{ success: boolean; message: string }>
```

### Usage in Components

View tracking is automatically triggered when an event is loaded in the `useEventDetails` hook:

```typescript
// Track event view when event is loaded
useEffect(() => {
  if (event) {
    // Track in analytics
    eventAnalytics.trackEventView(event);

    // Track in backend database
    if (apiClient.isAuthenticated()) {
      apiClient.events.trackEventView(event.id!).catch((error) => {
        console.error("Failed to track event view:", error);
        // Don't show error to user - view tracking should be silent
      });
    }
  }
}, [event, eventAnalytics, apiClient]);
```

## Engagement Metrics

View counts are now included in the `EventEngagementMetrics` interface:

```typescript
export interface EventEngagementMetrics {
  eventId: string;
  saveCount: number;
  scanCount: number;
  viewCount: number; // New field
  rsvpCount: number;
  goingCount: number;
  notGoingCount: number;
  totalEngagement: number; // Now includes viewCount
  lastUpdated: Date;
}
```

## Features

### Deduplication

- Each user can only have one view record per event (enforced by unique constraint)
- Subsequent views by the same user are ignored

### Error Handling

- View tracking failures don't affect the user experience
- Errors are logged but not shown to users
- Graceful degradation if tracking service is unavailable

### Redis Integration

- View changes are published to Redis for real-time updates
- Filter processor can recalculate popularity scores based on view counts

## Testing

### Backend Tests

- `UserEngagementService.test.ts` includes comprehensive tests for view tracking
- `eventHandlers.test.ts` includes tests for the API endpoint

### Mobile App Tests

- `events.test.ts` includes tests for the API client method

## Migration

To add view tracking to an existing database, you'll need to:

1. Add the `viewCount` column to the `users` table
2. Add the `viewCount` column to the `events` table
3. Create the `user_event_views` table
4. Add the new entity to the data source configuration

## Future Enhancements

Potential improvements to consider:

- View tracking with timestamps for analytics
- View tracking with session information
- View tracking with device/browser information
- View tracking with referrer information
- View tracking with time spent viewing
