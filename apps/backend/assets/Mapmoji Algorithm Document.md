# MapMoji Event Filtering Algorithm
## Technical Specification v1.0

### Executive Summary

The MapMoji Event Filtering Algorithm is a multi-factor scoring system designed to intelligently curate and rank events for display on a geospatial map interface. The algorithm balances temporal relevance, geographic proximity, social engagement metrics, and content quality while adapting its scoring distribution based on the total number of available events. This ensures users always see the most relevant events regardless of event density in their area.

---

## Algorithm Overview

### Core Principles

1. **Multi-Factor Relevance**: Events are scored using five key dimensions of relevance
2. **Relative Scoring**: Final relevance scores are contextualized against all competing events
3. **Geographic Distribution**: Prevents overcrowding through intelligent spatial clustering
4. **Temporal Awareness**: Prioritizes events based on time proximity and urgency
5. **Social Validation**: Incorporates user engagement signals to surface popular events

### Processing Pipeline

The algorithm operates through a six-stage pipeline:

1. **Pre-filtering**: Remove obviously irrelevant events
2. **Raw Scoring**: Calculate absolute relevance scores across five dimensions
3. **Relative Normalization**: Adjust scores based on competitive context
4. **Ranking**: Sort events by normalized relevance scores
5. **Geographic Clustering**: Apply spatial distribution constraints
6. **Final Selection**: Return top N events for display

---

## Stage 1: Pre-filtering

### Purpose
Eliminate events that fail basic relevance criteria before expensive scoring calculations.

### Elimination Criteria

**Status-Based Filtering:**
- Remove events with status `REJECTED` or `EXPIRED`
- Retain events with status `PENDING` or `VERIFIED`

**Geographic Filtering:**
- Remove events outside the requested viewport bounds
- Viewport defined by north/south/east/west coordinate boundaries

**Temporal Filtering:**
- Remove non-recurring events more than 24 hours in the past
- Remove events more than 30 days in the future
- For recurring events, calculate next occurrence and apply same rules

### Expected Reduction
Typically reduces candidate set by 60-80% depending on viewport size and temporal window.

---

## Stage 2: Raw Scoring

### Scoring Framework

Each event receives a raw score calculated as a weighted sum of five component scores:

```
Raw Score = (T × W_t) + (D × W_d) + (P × W_p) + (R × W_r) + (C × W_c)
```

Where:
- T = Time Proximity Score
- D = Distance Proximity Score  
- P = Popularity Score
- R = Recency Score
- C = Confidence Score
- W_x = Weight for each component

### Default Weight Distribution

| Component | Weight | Rationale |
|-----------|--------|-----------|
| Time Proximity | 25% | Events happening soon are most actionable |
| Distance Proximity | 20% | Location convenience drives attendance |
| Popularity | 30% | Social proof indicates event quality |
| Recency | 15% | Fresh discoveries feel more relevant |
| Confidence | 10% | AI parsing accuracy affects reliability |

### Component Scoring Details

#### Time Proximity Score (0.0 - 1.0)

**Calculation Logic:**
- Events in the past (within 24h): Linear decay from 1.0 to 0.0
- Events 0-2 hours future: Score = 1.0 (peak urgency)
- Events 2-24 hours future: Score = 0.8 (high relevance)
- Events 24-72 hours future: Linear decay from 0.8 to 0.3
- Events beyond 72 hours: Score = 0.1 (low priority)

**Recurring Event Handling:**
- Calculate next occurrence date from current time
- Apply same scoring logic to next occurrence
- Events past their recurrence end date receive score = 0.0

#### Distance Proximity Score (0.0 - 1.0)

**Reference Point Priority:**
1. User's current location (if available)
2. Center point of requested viewport

**Distance Bands:**
- 0-1 km: Score = 1.0
- 1-5 km: Score = 0.8
- 5-15 km: Score = 0.6
- 15-50 km: Linear decay from 0.6 to 0.2
- Beyond 50 km: Score = 0.1

**Distance Calculation:**
Uses Haversine formula for great-circle distance between coordinates.

#### Popularity Score (0.0 - 1.0)

**Engagement Metrics:**
- Scan Count: Weight = 1.0, Normalization = 10 scans = 1.0
- Save Count: Weight = 3.0, Normalization = 5 saves = 1.0  
- RSVP Count: Weight = 5.0, Normalization = 3 RSVPs = 1.0

**Calculation:**
```
Popularity = (scan_norm × 1.0 + save_norm × 3.0 + rsvp_norm × 5.0) / 9.0
```

**Rationale:**
RSVPs indicate strongest intent, saves show moderate interest, scans represent basic awareness.

#### Recency Score (0.0 - 1.0)

**Age-Based Scoring:**
- 0-1 hour old: Score = 1.0
- 1-6 hours old: Score = 0.9
- 6-24 hours old: Score = 0.7
- 1-3 days old: Score = 0.5
- 3-7 days old: Score = 0.3
- Beyond 7 days: Score = 0.1

**Purpose:**
Provides boost to newly discovered events, assuming fresh content is more engaging.

#### Confidence Score (0.0 - 1.0)

**Direct Mapping:**
Uses AI-generated confidence score from event parsing process. Events without confidence scores default to 0.5.

**Impact:**
Ensures poorly parsed events with uncertain data don't rank highly despite other positive signals.

---

## Stage 3: Relative Normalization

### Purpose
Convert absolute scores to relative rankings that adapt to competitive context.

### Adaptive Scoring Strategy

#### Single Event (N = 1)
- **Relative Score**: 1.0
- **Rationale**: Only available option deserves maximum relevance

#### Few Events (N = 2-3)  
- **Score Range**: 0.6 - 1.0
- **Distribution**: Gentle linear curve
- **Rationale**: Maintain high scores when options are limited

#### Medium Set (N = 4-10)
- **Score Range**: 0.3 - 1.0  
- **Distribution**: Balanced linear distribution
- **Rationale**: Create clear differentiation while keeping reasonable floor

#### Large Set (N = 11+)
- **Score Range**: 0.0 - 1.0
- **Distribution**: Power curve with exponent based on set size
- **Rationale**: Emphasize clear winners when many options compete

### Normalization Process

1. **Rank Calculation**: Sort events by raw score to establish ordinal rankings
2. **Percentile Mapping**: Convert rank to percentile (0-100th percentile)
3. **Curve Application**: Apply appropriate distribution curve based on set size
4. **Quality Blending**: For large sets, blend percentile ranking with normalized raw score quality

### Quality Blending Formula

For event sets with N > 10:
```
Final_Score = (Percentile_Score × (1 - Quality_Weight)) + (Normalized_Raw_Score × Quality_Weight)

Where Quality_Weight = min(0.3, N / 100)
```

This ensures that with very large event sets, raw score quality becomes increasingly important alongside relative ranking.

---

## Stage 4: Ranking

Simple descending sort by relative score. Events with identical scores maintain their original temporal ordering (stable sort).

---

## Stage 5: Geographic Clustering

### Purpose
Prevent visual overcrowding by ensuring minimum spatial separation between displayed events.

### Clustering Algorithm

**Greedy Selection Process:**
1. Iterate through events in descending score order
2. For each candidate event, calculate distance to all already-selected events
3. If minimum distance to any selected event < threshold, reject candidate
4. Otherwise, add candidate to final result set

**Distance Threshold:**
- Default: 0.5 km minimum separation
- Configurable based on zoom level and display density requirements

**Distance Calculation:**
Uses same Haversine formula as proximity scoring for consistency.

### Trade-off Considerations

Clustering may remove high-scoring events in favor of geographic diversity. This trade-off prioritizes user experience (avoiding visual clutter) over pure relevance optimization.

---

## Stage 6: Final Selection

Return the top N events from the clustered result set, where N is configurable per request (default: 50).

---

## Configuration Parameters

### Tunable Weights

| Parameter | Default | Range | Impact |
|-----------|---------|-------|--------|
| Time Proximity Weight | 0.25 | 0.0-1.0 | Urgency vs. planning balance |
| Distance Proximity Weight | 0.20 | 0.0-1.0 | Local vs. regional scope |
| Popularity Weight | 0.30 | 0.0-1.0 | Social proof influence |
| Recency Weight | 0.15 | 0.0-1.0 | Fresh content preference |
| Confidence Weight | 0.10 | 0.0-1.0 | Data quality importance |

### Threshold Parameters

| Parameter | Default | Range | Impact |
|-----------|---------|-------|--------|
| Max Events Returned | 50 | 1-500 | Response size vs. completeness |
| Time Decay Hours | 72 | 12-168 | Future event relevance window |
| Max Distance KM | 50 | 5-200 | Geographic scope limitation |
| Min Cluster Distance | 0.5 | 0.1-5.0 | Spatial distribution density |

---

## Performance Characteristics

### Computational Complexity

- **Pre-filtering**: O(N) where N = total events
- **Raw Scoring**: O(N) with 5 scoring calculations per event
- **Relative Normalization**: O(N log N) due to sorting requirement
- **Geographic Clustering**: O(N²) in worst case, O(N) in typical case
- **Overall Complexity**: O(N²) worst case, O(N log N) typical case

### Optimization Opportunities

1. **Spatial Indexing**: Use R-tree or similar for geographic pre-filtering
2. **Score Caching**: Cache component scores for unchanged events
3. **Incremental Updates**: Recalculate only affected events when data changes
4. **Parallel Processing**: Score calculation is embarrassingly parallel

### Expected Performance

For typical urban viewport with 1000-5000 candidate events:
- Processing time: < 100ms on modern hardware
- Memory usage: < 10MB for scoring calculations
- Database queries: 1 main query + optional user location lookup

---

## Quality Assurance

### Validation Metrics

1. **Relevance Correlation**: Compare algorithm rankings with user engagement
2. **Geographic Distribution**: Measure spatial clustering effectiveness  
3. **Temporal Accuracy**: Validate time-based scoring against attendance patterns
4. **User Satisfaction**: A/B test different weight configurations

### Monitoring Indicators

1. **Score Distribution**: Track relative score ranges across different event set sizes
2. **Component Contribution**: Monitor which scoring factors drive final rankings
3. **Clustering Impact**: Measure how many high-scoring events are filtered by clustering
4. **Performance Metrics**: Response times, memory usage, and database load

---

## Integration Guidelines

### API Request Parameters

```json
{
  "viewport": {
    "north": 40.7831,
    "south": 40.7489,
    "east": -73.9441,
    "west": -73.9927
  },
  "userLocation": {
    "lat": 40.7680,
    "lng": -73.9665
  },
  "maxEvents": 50,
  "customWeights": {
    "timeProximity": 0.25,
    "distanceProximity": 0.20,
    "popularity": 0.30,
    "recency": 0.15,
    "confidence": 0.10
  }
}
```

### Response Format

```json
{
  "events": [...],
  "metadata": {
    "totalCandidates": 1247,
    "preFilteredCount": 312,
    "clusteredOut": 18,
    "finalCount": 50,
    "processingTimeMs": 87
  }
}
```

---

## Future Enhancements

### Planned Improvements

1. **Machine Learning Integration**: Replace static weights with learned preferences
2. **Category-Aware Scoring**: Adjust scoring based on event categories
3. **Time-of-Day Optimization**: Factor in typical user activity patterns
4. **Weather Integration**: Adjust outdoor event scores based on weather forecasts
5. **Social Network Integration**: Boost events attended by user's connections

### Research Opportunities

1. **Multi-Objective Optimization**: Balance relevance, diversity, and serendipity
2. **Personalization**: Develop user-specific scoring profiles
3. **Temporal Patterns**: Learn from historical engagement to predict future relevance
4. **Collaborative Filtering**: Recommend events based on similar user preferences

---

## Conclusion

The MapMoji Event Filtering Algorithm provides a robust, scalable solution for intelligent event curation in geospatial applications. By combining multiple relevance signals with adaptive competitive scoring, it ensures users consistently see the most appropriate events for their context while maintaining good geographic distribution and visual clarity.

The algorithm's configurable nature allows for continuous optimization based on user behavior data and changing product requirements, while its computational efficiency supports real-time operation at scale.