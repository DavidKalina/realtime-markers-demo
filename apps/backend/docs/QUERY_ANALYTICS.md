# Query Analytics Service

The QueryAnalyticsService tracks search query performance and provides insights about popular queries and those that need attention. **Now powered by semantic embeddings for intelligent query clustering!**

## Overview

The service automatically tracks every search query made through the EventSearchService and provides analytics on:

- **Popular queries** (most searched)
- **Low hit rate queries** (queries that often return few or no results)
- **Zero result queries** (queries that consistently return no results)
- **Query performance metrics** (hit rates, average results, etc.)
- **Query clusters** (semantically similar queries grouped together)
- **Similar query discovery** (find queries with similar intent)

## Key Features

### 🧠 Semantic Query Clustering

Using OpenAI embeddings, the service can group similar queries together even if they use different words:

- "coffee shop" and "cafe" → Same cluster
- "music festival" and "concert event" → Same cluster
- "dinner tonight" and "restaurant now" → Same cluster

### 📊 Intelligent Analytics

- **Hit rate analysis** across similar queries
- **Content gap identification** for entire query clusters
- **Trend analysis** for related search patterns
- **Performance optimization** insights

## Database Schema

### QueryAnalytics Entity

```typescript
@Entity("query_analytics")
export class QueryAnalytics {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ type: "text" })
  query!: string;

  @Index()
  @Column({ type: "text" })
  normalizedQuery!: string;

  @Column({ type: "integer", default: 0 })
  totalSearches!: number;

  @Column({ type: "integer", default: 0 })
  totalHits!: number;

  @Column({ type: "integer", default: 0 })
  zeroResultSearches!: number;

  @Column({ type: "float", default: 0 })
  averageResultsPerSearch!: number;

  @Column({ type: "float", default: 0 })
  hitRate!: number; // percentage of searches that returned results

  @Column({ type: "timestamp", nullable: true })
  firstSearchedAt!: Date | null;

  @Column({ type: "timestamp", nullable: true })
  lastSearchedAt!: Date | null;

  @Column({ type: "jsonb", nullable: true })
  topResults!: string[] | null; // Array of event IDs that were most commonly returned

  @Column({ type: "jsonb", nullable: true })
  searchCategories!: string[] | null; // Categories that were most commonly searched with this query

  @Column({ type: "boolean", default: false })
  isPopular!: boolean; // Flag for queries that are searched frequently

  @Column({ type: "boolean", default: false })
  needsAttention!: boolean; // Flag for queries with low hit rates that might need content
}
```

## Service Integration

The QueryAnalyticsService is automatically injected into the EventSearchService and tracks every search:

```typescript
// In EventSearchService
private async trackSearchAnalytics(
  query: string,
  resultCount: number,
  results: SearchResult[]
): Promise<void> {
  // Extract event IDs and category IDs from results
  const eventIds = results.map(result => result.event.id);
  const categoryIds = results.flatMap(result =>
    result.event.categories?.map(cat => cat.id) || []
  );

  // Track the search analytics
  await this.queryAnalyticsService.trackSearch({
    query,
    resultCount,
    eventIds,
    categoryIds,
    timestamp: new Date()
  });
}
```

## API Endpoints

### Get Query Insights (Enhanced)

```
GET /api/admin/analytics/queries/insights?days=30&limit=10&minSearches=5&similarityThreshold=0.8
```

Returns comprehensive insights including:

- Popular queries
- Low hit rate queries
- Trending queries
- Zero result queries
- **Query clusters** (new!)

### Get Query Clusters

```
GET /api/admin/analytics/queries/clusters?similarityThreshold=0.8
```

Returns semantically grouped query clusters with:

- Representative query for each cluster
- Similar queries with similarity scores
- Combined performance metrics
- Attention flags for low-performing clusters

### Find Similar Queries

```
GET /api/admin/analytics/queries/{query}/similar?limit=10&similarityThreshold=0.8
```

Returns queries semantically similar to the input query with similarity scores.

### Get Popular Queries

```
GET /api/admin/analytics/queries/popular?limit=10
```

Returns the most frequently searched queries.

### Get Low Hit Rate Queries

```
GET /api/admin/analytics/queries/low-hit-rate?limit=10
```

Returns queries with hit rates below 50%.

### Get Zero Result Queries

```
GET /api/admin/analytics/queries/zero-results?limit=10
```

Returns queries that consistently return no results.

### Get Query Stats

```
GET /api/admin/analytics/queries/{query}/stats
```

Returns detailed statistics for a specific query.

### Update Query Flags

```
POST /api/admin/analytics/queries/update-flags
```

Updates the `isPopular` and `needsAttention` flags based on current data.

## Service Methods

### trackSearch(data: QueryAnalyticsData)

Tracks a search query and its results.

### getQueryInsights(options)

Returns comprehensive insights about query performance, now including clusters.

### getQueryClusters(similarityThreshold)

Returns semantically grouped query clusters using embeddings.

### findSimilarQueries(query, limit, similarityThreshold)

Finds queries semantically similar to the input query.

### getPopularQueries(limit)

Returns the most popular queries.

### getLowHitRateQueries(limit)

Returns queries with low hit rates.

### getZeroResultQueries(limit)

Returns queries that return no results.

### getQueryStats(query)

Returns detailed stats for a specific query.

### updateQueryFlags()

Updates popularity and attention flags.

## Use Cases

### 1. Content Gap Analysis (Enhanced)

Identify entire clusters of queries that consistently return no results:

```typescript
const clusters = await queryAnalyticsService.getQueryClusters(0.8);
const lowPerformingClusters = clusters.filter((c) => c.averageHitRate < 30);

// Example: All "coffee shop" related queries have low hit rates
// → Need to add more coffee shop events
```

### 2. Search Optimization (Enhanced)

Analyze popular query clusters to optimize search algorithms:

```typescript
const popularClusters = await queryAnalyticsService.getQueryClusters(0.8);
const topCluster = popularClusters[0];

// Example: "music events" cluster is very popular
// → Optimize search for music-related content
```

### 3. User Experience Monitoring (Enhanced)

Track low hit rate clusters to identify potential UX issues:

```typescript
const lowHitClusters = await queryAnalyticsService
  .getQueryClusters(0.8)
  .filter((c) => c.averageHitRate < 50);

// Example: "late night food" cluster has poor performance
// → Add more late-night dining options or improve search suggestions
```

### 4. Trend Analysis (Enhanced)

Monitor query cluster trends over time:

```typescript
const insights = await queryAnalyticsService.getQueryInsights({
  days: 7,
  limit: 20,
  minSearches: 3,
  similarityThreshold: 0.8,
});

// Analyze which query clusters are trending
const trendingClusters = insights.queryClusters.filter(
  (c) => c.totalSearches > 10,
);
```

### 5. Similar Query Discovery

Find related queries to understand user intent:

```typescript
const similarQueries = await queryAnalyticsService.findSimilarQueries(
  "coffee shop",
  10,
  0.8,
);

// Returns: ["cafe", "coffee", "espresso bar", "coffee house", etc.]
// → Understand what users are really looking for
```

## Performance Considerations

- **Embedding caching**: Similarity calculations are cached for performance
- **Query normalization**: Prevents duplicate tracking of similar queries
- **Database indexes**: Optimize analytics queries
- **Non-blocking tracking**: Errors don't affect search functionality
- **Configurable thresholds**: Adjust similarity sensitivity as needed

## Configuration

### Similarity Thresholds

- **0.9+**: Very similar queries (nearly identical intent)
- **0.8-0.9**: Similar queries (same general intent)
- **0.7-0.8**: Related queries (somewhat related intent)
- **<0.7**: Weakly related queries

### Recommended Settings

```typescript
// For tight clustering (fewer, more precise clusters)
const tightClusters = await getQueryClusters(0.85);

// For broad clustering (more clusters, broader categories)
const broadClusters = await getQueryClusters(0.75);
```

## Migration

To add query analytics to an existing database:

1. Run the migration: `1710000000013-AddQueryAnalytics.ts`
2. Ensure the EmbeddingService is properly configured
3. The service will automatically start tracking new searches
4. Historical data will not be available until searches are performed

## Future Enhancements

Potential improvements to consider:

- **Query clustering to group similar queries** ✅ (Implemented)
- **Seasonal trend analysis**
- **Geographic query analysis**
- **User behavior correlation**
- **Automated content suggestions based on zero-result queries**
- **Query performance alerts**
- **A/B testing for search algorithm improvements**
- **Real-time cluster updates**
- **Multi-language query clustering**
- **Query intent classification**
