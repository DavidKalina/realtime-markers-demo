# Batch Score Update System

## Overview

The Batch Score Update System replaces real-time score calculations with batched updates to improve performance and reduce computational overhead, especially when dealing with multiple users and frequent popularity updates.

## How It Works

### 1. Event Collection

- Instead of immediately recalculating scores when popularity metrics change (scans, saves, RSVPs), events are added to a batch queue
- Each event update includes metadata about the operation type and whether it's a popularity-related change

### 2. User Registration

- Users are registered with the batch service when they connect or update their filters/viewport
- The service tracks each user's current viewport, filters, and preferences

### 3. Batch Processing

- Every 15 minutes (configurable), the system processes all pending updates
- For each registered user, it:
  - Identifies which events are relevant to that user
  - Recalculates scores using the MapMoji algorithm or traditional filtering
  - Sends a single batch update message with all changes

### 4. Batch Update Messages

Users receive messages in this format:

```json
{
  "type": "batch-update",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "updates": {
    "creates": [...], // New events
    "updates": [...], // Updated events with new scores
    "deletes": [...]  // Event IDs to remove
  },
  "summary": {
    "totalEvents": 50,
    "newEvents": 5,
    "updatedEvents": 10,
    "deletedEvents": 2
  }
}
```

## Configuration

### Environment Variables

- `BATCH_INTERVAL_MS`: Interval between batch processing (default: 900000 = 15 minutes)
- `MAX_BATCH_SIZE`: Maximum events to process in one batch (default: 1000)
- `ENABLE_BATCHING`: Enable/disable batching system (default: true)

### Runtime Configuration

```typescript
// Update batch configuration at runtime
filterProcessor.updateBatchConfig({
  batchIntervalMs: 10 * 60 * 1000, // 10 minutes
  maxBatchSize: 500,
  enableBatching: true,
});

// Force process current batch immediately
await filterProcessor.forceProcessBatch();
```

## Performance Benefits

### Before (Real-time)

- Every popularity update triggered immediate score recalculation
- Each user received individual update messages
- High CPU usage during peak activity
- Potential for message flooding

### After (Batched)

- Popularity updates are queued and processed in batches
- Users receive consolidated updates every 15 minutes
- Reduced CPU usage and better resource utilization
- More efficient message delivery

## User Experience

### Immediate Updates

- Critical updates (CREATE, DELETE, non-popularity UPDATE) are still sent immediately
- Only popularity-related score changes are batched

### Batch Updates

- Users receive comprehensive updates every 15 minutes
- All score changes are applied in a single message
- Reduced client-side processing overhead

## Monitoring

### Statistics

The system provides detailed statistics:

```typescript
{
  batchesProcessed: 10,
  totalEventsProcessed: 1500,
  totalUsersUpdated: 25,
  averageBatchSize: 150,
  lastBatchTime: 1704067200000,
  pendingUpdates: 5,
  registeredUsers: 25,
  isProcessingBatch: false,
  config: {
    batchIntervalMs: 900000,
    maxBatchSize: 1000,
    enableBatching: true
  }
}
```

### Logging

- Detailed logs for batch processing events
- Performance metrics for each batch
- Error handling and recovery information

## Integration

### FilterProcessor Integration

The batch system is automatically integrated into the FilterProcessor:

- Users are registered when they connect or update preferences
- Events are automatically queued for batch processing
- Non-popularity updates still use immediate notification

### Client Integration

Clients need to handle the new `batch-update` message type:

```typescript
// Handle batch updates
if (message.type === "batch-update") {
  // Apply creates
  message.updates.creates.forEach((event) => addEvent(event));

  // Apply updates
  message.updates.updates.forEach((event) => updateEvent(event));

  // Apply deletes
  message.updates.deletes.forEach((id) => removeEvent(id));
}
```

## Fallback Behavior

If batching is disabled (`ENABLE_BATCHING=false`), the system falls back to the original real-time behavior:

- All updates are processed immediately
- Users receive individual update messages
- No batching overhead

## Testing

### Manual Testing

```typescript
// Force process a batch for testing
await filterProcessor.forceProcessBatch();

// Check current batch status
const stats = filterProcessor.getStats();
console.log("Batch stats:", stats);
```

### Load Testing

- Simulate multiple users with frequent popularity updates
- Monitor CPU usage and message delivery
- Verify batch processing intervals and sizes

## Future Enhancements

1. **Adaptive Batching**: Adjust batch intervals based on activity levels
2. **Priority Queuing**: Process high-priority updates more frequently
3. **User Grouping**: Batch updates for users with similar preferences
4. **Predictive Batching**: Anticipate peak activity times
5. **Distributed Processing**: Scale batch processing across multiple instances
