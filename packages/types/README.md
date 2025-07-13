# @realtime-markers/types

Shared TypeScript types derived from database entities for the realtime-markers project.

## Overview

This package provides comprehensive TypeScript type definitions that are derived from the shared database entities. It includes:

- **Database Entity Types**: Clean TypeScript interfaces for all database entities
- **API Request/Response Types**: Type definitions for API endpoints
- **Utility Types**: Common utility types used throughout the application
- **Enum Types**: All enums from the database entities

## Installation

This package is part of the monorepo and should be installed as a dependency in other apps:

```bash
pnpm add @realtime-markers/types
```

## Usage

### Importing Types

```typescript
// Import database entity types
import {
  User,
  Event,
  Category,
  UserRole,
  EventStatus,
} from "@realtime-markers/types";

// Import API types
import {
  CreateEventRequest,
  EventResponse,
  ApiResponse,
} from "@realtime-markers/types";

// Import utility types
import { DeepPartial, LoadingState, GeoPoint } from "@realtime-markers/types";
```

### Database Entity Types

```typescript
import { User, Event, Category } from "@realtime-markers/types";

// Use entity types
const user: User = {
  id: "123",
  email: "user@example.com",
  role: UserRole.USER,
  // ... other properties
};

const event: Event = {
  id: "456",
  title: "My Event",
  status: EventStatus.PENDING,
  // ... other properties
};
```

### API Request/Response Types

```typescript
import {
  CreateEventRequest,
  EventResponse,
  ApiResponse,
} from "@realtime-markers/types";

// API request type
const createEventRequest: CreateEventRequest = {
  title: "New Event",
  eventDate: "2024-01-01T10:00:00Z",
  location: {
    type: "Point",
    coordinates: [-122.4194, 37.7749],
  },
};

// API response type
const apiResponse: ApiResponse<EventResponse> = {
  success: true,
  data: {
    id: "123",
    title: "New Event",
    // ... other properties
  },
};
```

### Utility Types

```typescript
import { DeepPartial, LoadingState, GeoPoint } from "@realtime-markers/types";

// Deep partial type for updates
const eventUpdate: DeepPartial<Event> = {
  title: "Updated Title",
  description: "Updated description",
};

// Loading state
const loadingState: LoadingState = "loading";

// Geographic point
const location: GeoPoint = {
  latitude: 37.7749,
  longitude: -122.4194,
};
```

## Structure

```
src/
├── database/
│   └── entities.ts      # Database entity types
├── api/
│   ├── requests.ts      # API request types
│   └── responses.ts     # API response types
├── utils/
│   └── helpers.ts       # Utility type helpers
└── index.ts            # Main exports
```

## Available Types

### Database Entity Types

- `User`: User account information
- `Event`: Event data with location and metadata
- `Category`: Event categories
- `EventShare`: Event sharing functionality
- `Filter`: User filters and preferences
- `QueryAnalytics`: Analytics tracking
- `UserEventView`: Event view tracking
- `UserEventDiscovery`: Event discovery tracking
- `UserEventRsvp`: Event RSVP tracking
- `UserEventSave`: Event save tracking
- `CivicEngagement`: Civic engagement features
- `UserPushToken`: Push notification tokens

### Enums

- `UserRole`: USER, MODERATOR, ADMIN
- `EventStatus`: PENDING, VERIFIED, REJECTED, EXPIRED
- `RecurrenceFrequency`: DAILY, WEEKLY, BIWEEKLY, MONTHLY, YEARLY
- `DayOfWeek`: SUNDAY, MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY

### API Types

#### Request Types

- `LoginRequest`, `RegisterRequest`: Authentication
- `CreateEventRequest`, `UpdateEventRequest`: Event management
- `GetEventsRequest`: Event queries
- `EventInteractionRequest`: Event interactions
- `SearchRequest`: Search functionality

#### Response Types

- `ApiResponse<T>`: Generic API response wrapper
- `PaginatedResponse<T>`: Paginated data responses
- `EventResponse`, `EventsResponse`: Event data responses
- `UserResponse`, `UsersResponse`: User data responses
- `ErrorResponse`: Error handling

### Utility Types

- `DeepPartial<T>`: Deep partial object type
- `Optional<T, K>`: Make specific keys optional
- `EntityId`: Database entity ID type
- `HttpMethod`: HTTP method types
- `PaginationParams`: Pagination parameters
- `LoadingState`: Loading state management
- `GeoPoint`: Geographic coordinates
- `AppError`: Application error type

## Development

### Building

```bash
pnpm build
```

### Development Mode

```bash
pnpm dev
```

## Dependencies

- `@realtime-markers/database`: Shared database entities
- `geojson`: Geographic data types

## Benefits

1. **Type Safety**: Full TypeScript support across all applications
2. **Consistency**: Shared types ensure consistency across apps
3. **IntelliSense**: Better IDE support with comprehensive types
4. **Documentation**: Types serve as living documentation
5. **Refactoring**: Safe refactoring with type checking

## Integration with Database Package

This types package works seamlessly with the `@realtime-markers/database` package:

```typescript
import { User } from "@realtime-markers/database"; // TypeORM entity
import { User as UserType } from "@realtime-markers/types"; // Clean TypeScript type

// Use TypeORM entity for database operations
const userEntity = new User();
userEntity.email = "user@example.com";

// Use clean type for API responses
const userResponse: UserType = {
  id: userEntity.id,
  email: userEntity.email,
  // ... other properties
};
```
