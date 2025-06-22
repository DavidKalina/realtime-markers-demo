# Real-Time Geospatial Entity Specification

## Overview

This document outlines the specification for adding new real-time geospatial entities to the unified platform. The architecture is designed to be extensible and maintain clear separation of concerns.

## Architecture Components

### 1. Entity Types

Each entity type must implement the following interfaces:

```typescript
interface EntityProcessor<T> {
  processEntity(operation: string, record: T): Promise<void>;
  calculateRelevanceScore(entity: T, context: RelevanceContext): number;
  isAccessible(entity: T, userId: string): boolean;
}

interface FilteringStrategy<T> {
  filterEntities(
    entities: T[],
    context: FilterContext,
  ): Promise<Array<T & { relevanceScore?: number }>>;
  updateConfig(config: Record<string, unknown>): void;
  getStats(): Record<string, unknown>;
}
```

### 2. Required Services

#### Entity Processing Service

- **Purpose**: Handles CRUD operations and real-time updates
- **Requirements**:
  - Process entity changes (CREATE, UPDATE, DELETE)
  - Update spatial cache
  - Trigger user notifications
  - Handle entity-specific business logic

#### Entity Filtering Service

- **Purpose**: Filters entities based on user preferences and context
- **Requirements**:
  - Apply user filters
  - Calculate relevance scores
  - Handle viewport-based filtering
  - Support entity-specific filtering logic

#### Entity Publisher

- **Purpose**: Publishes filtered entities to users via WebSocket
- **Requirements**:
  - Publish to dedicated Redis channel: `user:${userId}:filtered-${entityType}`
  - Include relevance scores
  - Handle batch updates
  - Support entity-specific message formats

### 3. Cache Integration

#### Spatial Cache Service

- **Purpose**: Maintains spatial index for efficient viewport queries
- **Requirements**:
  - Support spatial queries (viewport, radius, etc.)
  - Handle entity updates in real-time
  - Provide statistics and monitoring

### 4. WebSocket Integration

#### Message Format

Each entity type must define its message format:

```typescript
interface EntityMessage {
  type: string;
  timestamp: string;
  entities: Entity[];
  summary: {
    totalEntities: number;
    newEntities: number;
    // Entity-specific fields
  };
}
```

#### Channel Pattern

- Events: `user:${userId}:filtered-events`
- Civic Engagements: `user:${userId}:filtered-civic-engagements`
- New Entity: `user:${userId}:filtered-${entityType}`

## Implementation Checklist

### Phase 1: Core Infrastructure

- [ ] Define entity type and interfaces
- [ ] Create entity processor
- [ ] Implement filtering strategy
- [ ] Add spatial cache integration

### Phase 2: Processing Pipeline

- [ ] Create entity processing service
- [ ] Implement entity filtering service
- [ ] Add entity publisher
- [ ] Integrate with hybrid batcher

### Phase 3: Real-Time Updates

- [ ] Set up Redis message handling
- [ ] Implement WebSocket forwarding
- [ ] Add user notification service
- [ ] Test real-time updates

### Phase 4: Mobile Integration

- [ ] Update mobile app to handle new entity type
- [ ] Add entity-specific UI components
- [ ] Implement entity filtering on client
- [ ] Test end-to-end functionality

## Example: Adding a New Entity Type

### 1. Define Entity Type

```typescript
export interface NewEntity {
  id: string;
  title: string;
  location: Point;
  // Entity-specific fields
}
```

### 2. Create Entity Processor

```typescript
export class NewEntityProcessor implements EntityProcessor<NewEntity> {
  async processEntity(operation: string, record: NewEntity): Promise<void> {
    // Handle entity processing
  }

  calculateRelevanceScore(
    entity: NewEntity,
    context: RelevanceContext,
  ): number {
    // Calculate relevance score
  }

  isAccessible(entity: NewEntity, userId: string): boolean {
    // Check access permissions
  }
}
```

### 3. Implement Filtering Strategy

```typescript
export class NewEntityFilterStrategy implements FilteringStrategy<NewEntity> {
  async filterEntities(
    entities: NewEntity[],
    context: FilterContext,
  ): Promise<Array<NewEntity & { relevanceScore?: number }>> {
    // Apply filtering logic
  }
}
```

### 4. Create Services

```typescript
// Processing service
const newEntityProcessingService = createNewEntityProcessingService(
  newEntityProcessor,
  spatialCacheService,
  redisPub,
);

// Filtering service
const newEntityFilteringService = createNewEntityFilteringService(
  filterMatcher,
  relevanceScoringService,
  eventPublisher,
  redisPub,
);
```

### 5. Register with Platform

```typescript
entityRegistry.registerEntityType(
  {
    type: "new_entity",
    displayName: "New Entities",
    hasLocation: true,
    isPublic: true,
    // Configuration
  },
  newEntityProcessor,
  newEntityProcessingService,
  newEntityCacheService,
  newEntityFilteringStrategy,
);
```

## Benefits of This Architecture

1. **Separation of Concerns**: Each entity type has its own processing, filtering, and publishing pipeline
2. **Extensibility**: New entity types can be added without modifying existing code
3. **Performance**: Dedicated channels and services prevent interference between entity types
4. **Maintainability**: Clear interfaces and specifications make the codebase easier to understand and maintain
5. **Scalability**: Each entity type can be scaled independently

## Current Implementation

- **Events**: Fully implemented with MapMoji filtering and traditional filtering
- **Civic Engagements**: Implemented with basic filtering and separate publishing channel
- **Future Entities**: Can follow the same pattern for consistent architecture
