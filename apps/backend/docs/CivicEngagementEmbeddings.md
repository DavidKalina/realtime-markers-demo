# CivicEngagement Embeddings

This document describes the embedding functionality added to the CivicEngagement entity for semantic search capabilities.

## Overview

CivicEngagement entities now support full-text embedding generation, similar to the Event entity. This enables semantic search functionality that can find relevant civic engagements based on natural language queries.

## Implementation Details

### Database Schema

The `civic_engagements` table now includes an `embedding` column:

```sql
ALTER TABLE "civic_engagements"
ADD COLUMN "embedding" text;
```

### Entity Changes

The `CivicEngagement` entity includes an embedding field:

```typescript
@Column({ name: "embedding", type: "text", nullable: true })
embedding?: string;
```

### Embedding Generation

Embeddings are generated using a structured text format that includes:

- **Title** (repeated 3 times for emphasis)
- **Type** (POSITIVE_FEEDBACK, NEGATIVE_FEEDBACK, IDEA)
- **Description**
- **Location** (address)
- **Location Notes**

Example text format:

```
TITLE: Fix the pothole Fix the pothole Fix the pothole
TYPE: NEGATIVE_FEEDBACK
DESCRIPTION: There's a large pothole on Main Street that needs repair
LOCATION: 123 Main Street
LOCATION_NOTES: Near the intersection with Oak Avenue
```

### Service Integration

The `CivicEngagementService` now includes:

1. **Automatic embedding generation** during creation and updates
2. **Semantic search functionality** via `searchCivicEngagements()`
3. **Fallback to text search** if embedding service is unavailable

### CivicEngagementSearchService

A dedicated search service provides advanced search capabilities:

- **Semantic search** with hybrid scoring (embedding + text matching)
- **Caching** for improved performance
- **Cursor-based pagination** for efficient large result sets
- **Specialized queries** by type, status, creator, and recency
- **Nearby search** with geographic filtering

### CivicEngagementCacheService

A dedicated cache service provides caching capabilities:

- **Civic engagement caching** with memory and Redis support
- **Search result caching** for improved performance
- **Cache invalidation** for data consistency
- **Cache statistics** for monitoring performance
- **Pattern-based invalidation** for bulk operations

### API Endpoints

#### Semantic Search

```
GET /api/civic-engagements/search/:query?limit=10
```

Returns civic engagements ranked by semantic similarity to the query.

#### Recent Civic Engagements

```
GET /api/civic-engagements/recent?limit=10&cursor=...
```

Returns recently created civic engagements with cursor-based pagination.

#### By Type

```
GET /api/civic-engagements/type/:type?limit=10&cursor=...
```

Returns civic engagements filtered by type (POSITIVE_FEEDBACK, NEGATIVE_FEEDBACK, IDEA).

#### By Status

```
GET /api/civic-engagements/status/:status?limit=10&cursor=...
```

Returns civic engagements filtered by status (PENDING, IN_REVIEW, IMPLEMENTED, CLOSED).

#### By Creator

```
GET /api/civic-engagements/creator/:creatorId?limit=10&cursor=...
```

Returns civic engagements created by a specific user.

#### Statistics

```
GET /api/civic-engagements/stats
```

Returns aggregated statistics about civic engagements.

### Utility Functions

- `generateCivicEngagementEmbedding()` - Generates embeddings for new civic engagements
- `prepareCivicEngagementUpdateData()` - Generates embeddings for updates when content changes

### Migration

Run the migration to add the embedding column:

```bash
bun run migration:run
```

### Scripts

Generate embeddings for existing civic engagements:

```bash
bun run scripts/generate-civic-engagement-embeddings.ts
```

## Usage Examples

### Creating a Civic Engagement with Embedding

```typescript
const civicEngagement = await civicEngagementService.createCivicEngagement({
  title: "Fix the pothole",
  description: "There's a large pothole on Main Street that needs repair",
  type: CivicEngagementType.NEGATIVE_FEEDBACK,
  address: "123 Main Street",
  locationNotes: "Near the intersection with Oak Avenue",
  creatorId: "user-id",
});
// Embedding is automatically generated and stored
```

### Semantic Search

```typescript
const results = await civicEngagementSearchService.searchCivicEngagements(
  "road damage that needs fixing",
  10,
);
// Returns civic engagements semantically similar to the query
```

### Recent Civic Engagements

```typescript
const recent = await civicEngagementSearchService.getRecentCivicEngagements({
  limit: 20,
});
// Returns the 20 most recent civic engagements
```

### Civic Engagements by Type

```typescript
const ideas = await civicEngagementSearchService.getCivicEngagementsByType(
  "IDEA",
  { limit: 10 },
);
// Returns the 10 most recent ideas
```

### Updating with Embedding Regeneration

```typescript
const updated = await civicEngagementService.updateCivicEngagement(
  "civic-engagement-id",
  {
    title: "Updated title",
    description: "Updated description",
  },
);
// Embedding is automatically regenerated when title or description changes
```

## Search Scoring

The search service uses a hybrid scoring system:

- **Semantic similarity (50%)** - Based on embedding cosine similarity
- **Text matching (35%)** - Exact and partial text matches in title, description, address, and location notes
- **Type matching (10%)** - Relevance based on civic engagement type
- **Recency boost (5%)** - Newer civic engagements get a slight boost

## Error Handling

- Embedding generation errors are logged but don't prevent civic engagement creation/updates
- If embedding service is unavailable, the system falls back to text-based search
- Graceful degradation ensures the application continues to function

## Performance Considerations

- Embeddings are cached to avoid repeated generation
- Search results are cached for 5 minutes to improve response times
- Semantic search uses pgvector for efficient similarity calculations
- Cursor-based pagination provides efficient navigation through large result sets
- Fallback to text search ensures functionality even without embeddings

## Future Enhancements

- Support for embedding-based filtering in combination with other filters
- Batch embedding generation for improved performance
- Embedding similarity thresholds for duplicate detection
- Integration with recommendation systems
- Advanced analytics and insights based on search patterns
