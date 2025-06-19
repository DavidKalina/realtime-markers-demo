# Query Insights Dashboard

The Query Insights Dashboard provides comprehensive analytics for search queries across the platform, helping administrators understand user search patterns and optimize content discovery.

## Features

### Overview Metrics

- **Total Queries**: Number of unique search terms
- **Total Searches**: Total number of search executions
- **Average Hit Rate**: Percentage of successful searches
- **Zero Hit Queries**: Queries that return no results
- **Low Hit Rate Queries**: Queries with less than 50% success rate

### Popular Queries

Displays the most frequently searched terms with:

- Search count
- Hit rate percentage
- Average results per search
- Clickable links to detailed statistics

### Trending Queries

Shows queries with recent growth in search volume, including:

- Recent search count
- Growth rate percentage
- Visual indicators for trending status

### Query Clusters

Groups similar queries that may need content optimization:

- Representative query for each cluster
- Similarity scores between queries
- Average hit rate for the cluster
- Expandable view to see all similar queries
- Attention indicators for low-performing clusters

### Low Hit Rate Queries

Identifies queries with poor performance:

- Queries with less than 50% success rate
- Search frequency and last searched date
- Clickable links to detailed analysis

### Zero Result Queries

Highlights queries that consistently return no results:

- Search count and last searched date
- Clear indication of 0% hit rate
- Priority for content creation or search optimization

## Navigation

### Main Dashboard

- Access via "Query Insights" tab in the admin dashboard
- URL: `/query-insights`

### Query Details

- Click on any query to view detailed statistics
- URL: `/query-insights/[query]`
- Shows comprehensive metrics for individual queries

## API Endpoints

The dashboard uses the following backend endpoints:

- `GET /api/admin/analytics/queries/insights` - Main insights data
- `GET /api/admin/analytics/queries/popular` - Popular queries
- `GET /api/admin/analytics/queries/low-hit-rate` - Low hit rate queries
- `GET /api/admin/analytics/queries/zero-results` - Zero result queries
- `GET /api/admin/analytics/queries/clusters` - Query clusters
- `GET /api/admin/analytics/queries/[query]/stats` - Individual query statistics
- `GET /api/admin/analytics/queries/[query]/similar` - Similar queries

## Use Cases

### Content Optimization

- Identify popular search terms to create relevant content
- Find zero-result queries that need new events or categories
- Analyze low-performing queries for improvement opportunities

### Search Experience

- Monitor search success rates across the platform
- Identify trending topics and interests
- Optimize search algorithms based on user behavior

### User Engagement

- Understand what users are looking for
- Identify gaps in content coverage
- Track search patterns over time

## Technical Implementation

### Components

- `QueryInsightsDashboard` - Main dashboard container
- `PopularQueriesSection` - Popular queries display
- `TrendingQueriesSection` - Trending queries display
- `QueryClustersSection` - Query clusters with expandable details
- `LowHitRateQueriesSection` - Low performing queries
- `ZeroResultQueriesSection` - Zero result queries

### Data Management

- `useQueryInsights` hook for data fetching and state management
- Real-time refresh capabilities
- Error handling and loading states
- Configurable time ranges and limits

### Styling

- Consistent with existing dashboard design
- Color-coded badges for different performance levels
- Hover effects and interactive elements
- Responsive design for different screen sizes

## Future Enhancements

- Export functionality for query analytics
- Advanced filtering and search within results
- Historical trend analysis
- Automated recommendations for content creation
- Integration with content management workflows
