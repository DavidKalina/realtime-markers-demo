# EventService Refactoring

## Overview

The original `EventService` was a monolithic service with over 2,200 lines of code handling multiple responsibilities. This refactoring breaks it down into smaller, focused services following the Single Responsibility Principle.

## New Service Architecture

### 1. EventLifecycleService

**Responsibilities**: Basic CRUD operations and state changes of events

- `createEvent(input)`
- `getEventById(id)`
- `updateEvent(id, data)`
- `deleteEvent(id)`
- `updateEventStatus(id, status)`
- `storeDetectedQRCode(eventId, qrCodeData)`

**Dependencies**: DataSource, LevelingService, EventCacheService, GoogleGeocodingService, RedisService

### 2. EventSearchService

**Responsibilities**: All search and querying functionality

- `searchEvents(query, limit, cursor)` (text & semantic)
- `getNearbyEvents(lat, lng, radius, startDate, endDate)`
- `getEventsByCategories(categoryIds, options)`
- `getEventsByCategory(categoryId, options)`
- `searchEventsByFilter(filter, options)`

**Dependencies**: DataSource, EventCacheService, OpenAIService

### 3. UserEngagementService

**Responsibilities**: User interactions with events

- `toggleSaveEvent(userId, eventId)`
- `isEventSavedByUser(userId, eventId)`
- `getSavedEventsByUser(userId, options)`
- `toggleRsvpEvent(userId, eventId, status)`
- `getUserRsvpStatus(userId, eventId)`
- `createDiscoveryRecord(userId, eventId)`
- `getDiscoveredEventsByUser(userId, options)`

**Dependencies**: DataSource, RedisService, LevelingService

### 4. EventSharingService

**Responsibilities**: Private event sharing management

- `shareEventWithUsers(eventId, sharedById, sharedWithIds)`
- `removeEventShares(eventId, sharedWithIds)`
- `getEventSharedWithUsers(eventId)`
- `getEventShares(eventId)`
- `hasEventAccess(eventId, userId)`

**Dependencies**: DataSource, RedisService, EventCacheService

### 5. EventAnalysisService

**Responsibilities**: Complex analysis and AI-powered features

- `getClusterHubData(markerIds)`

**Dependencies**: DataSource, EventCacheService, OpenAIService

### 6. EventAdminService

**Responsibilities**: Administrative tasks and maintenance

- `cleanupOutdatedEvents(batchSize)`
- `getEvents(options)`
- `getAllCategories()`
- `recalculateCounts()`

**Dependencies**: DataSource, EventCacheService

## Benefits of This Refactoring

### 1. Improved Testability

- Each service has fewer dependencies to mock
- Focused tests for specific responsibilities
- Easier to test individual features in isolation

### 2. Better Maintainability

- Clear separation of concerns
- Easier to understand and modify specific functionality
- Reduced cognitive load when working on individual features

### 3. Enhanced Code Organization

- Logical grouping of related functionality
- Easier to find code responsible for specific features
- Better code navigation and discovery

### 4. Reduced Complexity

- Smaller, more focused classes
- Lower coupling between different concerns
- Easier to reason about individual services

## Migration Strategy

### Phase 1: Gradual Migration (Current)

- New `EventServiceRefactored` acts as a facade
- Delegates to smaller services while maintaining the same public interface
- Existing controllers can continue using the same interface
- No breaking changes to existing code

### Phase 2: Direct Service Usage

- Controllers can be updated to use specific services directly
- Example: Search controller uses `EventSearchService` directly
- User engagement controller uses `UserEngagementService` directly

### Phase 3: Complete Migration

- Remove the facade `EventServiceRefactored`
- All controllers use specific services
- Original `EventService` can be deprecated and removed

## Usage Examples

### Using the Facade (Current Approach)

```typescript
// Controllers continue to work as before
const eventService = createEventService(dependencies);
const events = await eventService.searchEvents("concert");
```

### Using Specific Services (Future Approach)

```typescript
// Controllers can use specific services directly
const searchService = createEventSearchService(searchDependencies);
const events = await searchService.searchEvents("concert");

const engagementService = createUserEngagementService(engagementDependencies);
await engagementService.toggleSaveEvent(userId, eventId);
```

## Transaction Handling

For operations that span multiple services (e.g., creating an event and sharing it), the facade handles the coordination. In the future, you might consider:

1. **Orchestrator Service**: A higher-level service that manages transactions across multiple services
2. **Domain Events**: Services publish events that other services consume
3. **Event Sourcing**: For complex workflows that require audit trails

## Testing Strategy

Each service can now be tested independently:

```typescript
// Test EventSearchService in isolation
describe("EventSearchService", () => {
  it("should search events by query", async () => {
    const searchService = createEventSearchService(mockDependencies);
    const results = await searchService.searchEvents("test");
    expect(results.results).toHaveLength(1);
  });
});
```

## Next Steps

1. **Write Tests**: Create comprehensive tests for each new service
2. **Update Controllers**: Gradually migrate controllers to use specific services
3. **Performance Monitoring**: Monitor performance impact of the refactoring
4. **Documentation**: Update API documentation to reflect the new architecture
5. **Training**: Ensure team members understand the new service boundaries

## Files Created

- `EventLifecycleService.ts` - Core CRUD operations
- `EventSearchService.ts` - Search and querying
- `UserEngagementService.ts` - User interactions
- `EventSharingService.ts` - Event sharing
- `EventAnalysisService.ts` - AI-powered analysis
- `EventAdminService.ts` - Administrative tasks
- `EventServiceRefactored.ts` - Facade service
- `README.md` - This documentation

This refactoring significantly improves the codebase's maintainability, testability, and organization while preserving all existing functionality.
