# Filter Processor Service Architecture

## Overview

The Filter Processor has been refactored to use a **unified architecture** that eliminates redundancy and provides clear service boundaries. This document outlines the current service roles and their relationships.

## Core Service Roles

### 1. UnifiedFilteringService (Primary Filtering Engine)

**Purpose**: Single source of truth for all filtering logic
**Responsibilities**:

- Handles both Events and Civic Engagements in unified messages
- Implements MapMoji, Traditional, and Hybrid filtering strategies
- Applies client-specific configurations (max events, entity types)
- Calculates relevance scores and sends filtered results
- **Replaces**: Individual EventFilteringService and CivicEngagementFilteringService

**Key Methods**:

- `calculateAndSendDiff()` - Main filtering and notification method
- Supports viewport-based and global filtering
- Handles client configuration (mobile vs dashboard)

### 2. HybridUserUpdateBatcherService (Batching & Scheduling)

**Purpose**: Manages real-time and batch processing of user updates
**Responsibilities**:

- Debounces individual user updates (real-time)
- Batches multiple user updates (efficiency)
- Schedules processing using the UnifiedFilteringService
- **Uses**: UnifiedFilteringService for actual filtering logic

**Key Methods**:

- `markUserAsDirty()` - Triggers user update processing
- `forceProcessBatch()` - Immediate batch processing
- `startPeriodicSweeper()` - Background batch processing

### 3. UnifiedSpatialCacheService (Data Storage)

**Purpose**: Centralized spatial data storage and retrieval
**Responsibilities**:

- Stores Events and Civic Engagements with spatial indexing
- Provides viewport-based queries
- Maintains cache statistics
- **Replaces**: Separate EventCacheService and CivicEngagementCacheService

### 4. UnifiedMessageHandler (Event Processing)

**Purpose**: Handles incoming entity updates and notifications
**Responsibilities**:

- Processes Redis messages for entity changes
- Determines affected users
- Sends WebSocket notifications
- **Uses**: EntityRegistry for entity type management

## Deprecated/Removed Services

### ❌ UserNotificationService (REMOVED)

**Reason for Removal**:

- **Redundant**: Duplicated filtering logic already in UnifiedFilteringService
- **Conflicting**: Individual event notifications vs batch processing approach
- **Unused**: Not actively used in main pipeline, only in stats
- **Architecture Mismatch**: System moved to unified batch processing

**What Replaced It**:

- UnifiedFilteringService handles all filtering and notification logic
- HybridUserUpdateBatcherService manages user update scheduling
- UnifiedMessageHandler handles incoming entity updates

### ❌ Legacy EventProcessor (RENAMED)

**Reason for Rename**:

- **Confusing**: Two EventProcessor classes with different purposes
- **Clarified**: Renamed to `LegacyEventCacheHandler` for clarity

## Service Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                    FilterProcessor                          │
│  (Main orchestrator - creates and coordinates services)     │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│              HybridUserUpdateBatcherService                 │
│  (Batching & Scheduling)                                    │
│  ┌─────────────────────────────────────────────────────────┐│
│  │            UnifiedFilteringService                      ││
│  │  (Single source of truth for filtering)                ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│              UnifiedSpatialCacheService                     │
│  (Data Storage & Spatial Indexing)                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              UnifiedMessageHandler                          │
│  (Incoming Event Processing)                                │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                EntityRegistry                           ││
│  │  (Entity Type Management)                               ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Entity Update Flow

```
Redis Message → UnifiedMessageHandler → EntityRegistry →
HybridUserUpdateBatcherService → UnifiedFilteringService →
UnifiedSpatialCacheService → EventPublisher → WebSocket
```

### 2. User Request Flow

```
User Request → HybridUserUpdateBatcherService →
UnifiedFilteringService → UnifiedSpatialCacheService →
EventPublisher → WebSocket
```

## Configuration

### UnifiedFilteringService Config

```typescript
{
  mapMojiConfig: {
    maxEvents: 1000,
    enableHybridMode: true
  },
  maxCivicEngagements: 100
}
```

### HybridUserUpdateBatcherService Config

```typescript
{
  debounceTimeoutMs: 200,    // Real-time debounce
  sweepIntervalMs: 5000,     // Batch processing interval
  maxBatchSize: 100,         // Max users per batch
  enableBatching: true       // Enable/disable batching
}
```

## Benefits of Unified Architecture

1. **Single Source of Truth**: UnifiedFilteringService handles all filtering logic
2. **Reduced Complexity**: Eliminated redundant UserNotificationService
3. **Better Performance**: Batch processing with debouncing
4. **Clearer Boundaries**: Each service has a well-defined responsibility
5. **Easier Testing**: Fewer interdependencies between services
6. **Consistent Behavior**: All filtering goes through the same pipeline

## Migration Notes

- **UserNotificationService**: Completely removed - functionality moved to UnifiedFilteringService
- **LegacyEventCacheHandler**: Renamed from EventProcessor for clarity
- **EntityInitializationService**: Removed wrapper service - root services now implement interface directly
- **FilterProcessor**: Simplified to use only unified services

## Future Considerations

1. **Monitoring**: All services provide comprehensive stats for monitoring
2. **Extensibility**: EntityRegistry allows easy addition of new entity types
3. **Performance**: Batch processing and debouncing optimize for high-throughput scenarios
4. **Client Support**: UnifiedFilteringService handles different client configurations
