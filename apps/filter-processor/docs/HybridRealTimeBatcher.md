# Hybrid Real-Time Batcher Strategy

## Overview

The Hybrid Real-Time Batcher Strategy combines two complementary approaches to achieve both real-time responsiveness and efficient batching:

1. **Debounce Timer**: Provides immediate updates for isolated changes
2. **Periodic Sweeper**: Guarantees updates are never delayed too long, even during event storms

## How It Works

### Internal State

The service manages three key pieces of state:

```typescript
// Users that need their event lists recalculated
const dirtyUserIds = new Set<string>();

// Individual debounce timers for each user
const userDebounceTimers = new Map<string, NodeJS.Timeout>();

// Periodic sweeper timer for the whole service
let periodicSweeper: NodeJS.Timeout | null = null;
```

### Debounce Timer Logic

When a user is marked as dirty:

1. **Add to dirty set**: `dirtyUserIds.add(userId)`
2. **Clear existing timer**: If a timer already exists for this user, clear it
3. **Set new timer**: Create a new 200ms timer for this specific user
4. **Process on timeout**: When the timer fires, process this user's update

**Benefits:**

- Rapid updates for isolated changes (~200ms latency)
- Prevents thundering herd during rapid user interactions (e.g., map panning)
- Each user gets their own timer, so they don't interfere with each other

### Periodic Sweeper Logic

Every 5 seconds, the sweeper:

1. **Collects all dirty users**: `Array.from(dirtyUserIds)`
2. **Processes in batches**: Handles up to 100 users per batch
3. **Clears timers**: Removes any pending debounce timers
4. **Continues processing**: Uses `setImmediate` to avoid blocking the event loop

**Benefits:**

- Guarantees no user waits more than 5 seconds for an update
- Efficiently handles event storms by batching updates
- Prevents starvation during high-velocity event streams

### Unified Processing Logic

Both the debounce timer and sweeper call the same `processUpdatesForUsers` function:

```typescript
async function processUpdatesForUsers(userIds: string[]): Promise<void> {
  for (const userId of userIds) {
    // 1. Remove from dirty set
    dirtyUserIds.delete(userId);

    // 2. Clear debounce timer
    if (userDebounceTimers.has(userId)) {
      clearTimeout(userDebounceTimers.get(userId)!);
      userDebounceTimers.delete(userId);
    }

    // 3. Get user state
    const viewport = getUserViewport(userId);
    const filters = getUserFilters(userId);

    // 4. Get relevant events
    const events = viewport
      ? eventCacheService.getEventsInViewport(viewport)
      : eventCacheService.getAllEvents();

    // 5. Calculate and send diff
    await eventFilteringService.calculateAndSendDiff(
      userId,
      events,
      viewport,
      filters,
    );
  }
}
```

## Configuration

```typescript
interface HybridUserUpdateBatcherConfig {
  debounceTimeoutMs?: number; // Default: 200ms
  sweepIntervalMs?: number; // Default: 5000ms
  maxBatchSize?: number; // Default: 100
  enableBatching?: boolean; // Default: true
}
```

## Usage Examples

### Normal Operation

```typescript
// User changes their viewport
batcher.markUserAsDirty("user-123", {
  reason: "viewport_change",
  timestamp: Date.now(),
});

// After 200ms, their update is processed automatically
```

### Event Storm Handling

```typescript
// During an event storm, many users are marked dirty
for (const userId of affectedUsers) {
  batcher.markUserAsDirty(userId, {
    reason: "event_update",
    eventId: "event-456",
  });
}

// The 5-second sweeper will batch process all of them efficiently
```

### Force Processing

```typescript
// Force immediate processing of all dirty users
await batcher.forceProcessBatch();
```

## Benefits

### Real-Time Feel

- Isolated changes are reflected in ~200ms
- Users perceive the system as responsive and real-time

### Efficiency

- Event storms are naturally coalesced into larger batches
- Prevents server overload during high-traffic periods
- Reduces Redis command overhead

### Reliability

- No user will ever wait more than 5 seconds for an update
- Handles edge cases like continuous event streams
- Graceful degradation under load

### Monitoring

The service provides comprehensive statistics:

- `totalUsersMarkedDirty`: Total users marked for updates
- `totalUsersProcessed`: Total users actually processed
- `totalDebounceTimersFired`: Number of debounce timer triggers
- `totalSweeperRuns`: Number of sweeper executions
- `currentDirtyUsers`: Currently pending users
- `currentActiveTimers`: Active debounce timers

## Integration

The hybrid batcher integrates seamlessly with the existing FilterProcessor architecture:

1. **EventFilteringService**: Provides the `calculateAndSendDiff` method
2. **EventCacheService**: Supplies events for viewport or global queries
3. **UserStateService**: Provides user filters and viewport data
4. **ViewportProcessor**: Handles viewport-specific processing

This design ensures that the hybrid batcher is a drop-in replacement for the previous batching strategy while providing superior performance characteristics.
