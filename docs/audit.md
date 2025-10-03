## System Audit: Current Architecture, Load Estimates, and Bottlenecks

### Scope
- Review of `websocket` and `filter-processor` services for throughput/scale characteristics
- High-level assessment of worker pipeline and feasibility of replacing with AWS SQS + Lambda

### Current Deployment (single node via docker-compose)
- Reverse proxy: Traefik
- Data: Postgres, Redis
- Services: `backend` (Bun + Hono), `websocket` (Bun WS), `filter-processor` (Bun), `worker`
- Internal comms: Redis pub/sub; some REST between services

### Websocket Service
- Tech: Bun.serve websockets, ioredis for pub/sub
- Subscriptions: global channels for discovery/notifications; per-user Redis subscribers for filtered streams
- Session management: `SessionManager` tracks client sessions, listens to `job:*:updates` and forwards job progress
- Per-connection operations:
  - JSON parse and light routing by `type`
  - On identification: subscribes to per-user Redis channel; fetches user filters via backend and triggers filter recalculation via Redis
  - Viewport updates: persists to Redis key `viewport:{userId}` and publishes to `viewport-updates`
  - Message fanout: forwards per-user messages to all user clients; sometimes transforms batch messages into multiple WS messages

Estimated capacity (single instance, moderate CPU):
- Baseline echo/forward cost is small (JSON parse + send). Bun WS can handle thousands of idling connections.
- The heavier path involves: per-user Redis subscription + message transformation and multiple sends per update.
- Practical envelope on a single 2 vCPU/4GB node:
  - Concurrent WS connections: 5k–15k idle; 1k–3k active with intermittent messages
  - Message throughput: ~5k–20k msgs/minute of small payloads with low transformation; lower if many messages are expanded (e.g., batch to per-item sends)
- Primary bottlenecks:
  - Per-user ioredis subscriber growth: each identified user establishes a dedicated Redis subscriber when messages are needed; thousands of subscribers on one Redis can create CPU/network pressure
  - Message fanout amplification (e.g., `replace-all` or splitting batch updates into many client messages)
  - Single instance state for `clients` map and backpressure handling

Immediate optimizations:
- Pool or multiplex user subscriptions using a single consumer plus server-side filtering to avoid N subscribers per user
- Rate-limit `replace-all` and prioritize differential updates
- Backpressure-aware send with buffering or dropping older updates per-user

### Filter-Processor Service
- Tech: Bun, ioredis pub/sub
- Responsibilities:
  - Maintains in-memory caches and spatial index; determines affected users per entity change
  - Tracks user viewports via Redis: stores `viewport:{userId}` and Redis GEO set `viewport:geo`
  - For each entity change, finds intersecting viewports (GEORADIUS + precise bounds check), limits affected users, formats notifications and publishes to `user:{id}:notifications` or `user:{id}:filtered-events`
  - Batching support: configurable batch size/timeout to process multiple messages together

Estimated capacity (single instance):
- Hot path per change: compute bounds, GEORADIUS (50km), fetch viewport JSON for candidates, precise bounds check, determine access, publish per-user notifications.
- With modest event rates and a few hundred to low thousands of active viewports, this is viable. Redis GEORADIUS is O(log N + M) where N is set size and M matches; total cost grows with active users.
- On 2 vCPU/4GB node with Redis on same host:
  - Active tracked users: ~5k–20k viewports before GEORADIUS + per-candidate GETs become notable
  - Update throughput: hundreds of entity updates/sec if affected-user sets are small (<50 users/update). If affected-user sets are large or frequent, throughput drops proportionally.
- Primary bottlenecks:
  - Redis GEO queries and per-candidate GET roundtrips
  - Per-update per-user publish amplification (N publishes per update)
  - Single-instance CPU and in-memory cache size constraints

Immediate optimizations:
- Reduce radius or dynamically adjust by entity type/zoom
- Cache viewports locally with TTL to avoid Redis GET per candidate
- Aggregate per-user updates into batches before publishing to minimize WS fanout

### Worker Pipeline
- Implementation: Redis-backed queue using lists and keys; polling every 1s; max 5 concurrent jobs; timeouts at 5 min
- Jobs drive heavy compute and integrations (OpenAI, embeddings, image processing, geocoding)

Feasibility of AWS SQS + Lambda replacement:
- SQS Standard queue replaces `jobs:pending` list; message body includes jobId + type + payload pointer (e.g., S3 key)
- Producer: current `JobQueue.enqueue` can be adapted to publish to SQS and store job metadata in Redis or DynamoDB
- Consumers:
  - Lambda suitable for short/medium jobs (<15 min). Your current 5-minute timeout fits Lambda’s default; can be extended to 15 minutes if needed.
  - For GPU/OpenAI/image workloads, consider AWS Fargate or ECS service as workers pulling from SQS for longer-running or resource-heavy tasks.
- Progress updates: Lambda can publish progress to Redis pub/sub (`websocket:job_updates`) via a VPC-enabled ElastiCache or to an API in `backend` that republishes to Redis. Alternatively, switch to API Gateway WebSockets or EventBridge -> persistent storage -> WS bridge.
- File buffers: move large buffers to S3; store pointers in job data to avoid Redis payload bloat.

Tradeoffs:
- Pros: autoscaling consumers, built-in durability, decoupling, cost-per-use
- Cons: cold starts, 15-min max for Lambda, VPC networking for Redis/DB, increased operational surface (IAM, retries, dead-letter queues)

### Overall Feasibility to Distribute
- Websocket: horizontally scalable behind a TCP/WebSocket load balancer with sticky sessions (or consistent hashing on `clientId`). Redis pub/sub becomes a shared bus (prefer ElastiCache Redis). State is mostly ephemeral; per-instance `clients` map is fine if you publish per-user messages to the bus.
- Filter-processor: shard by spatial partitioning or by userId hash. Each shard subscribes only to relevant entity channels. Alternatively, run multiple replicas and ensure idempotency on publishes; consider moving viewport store to a purpose-built service (e.g., Redis Cluster or a small service maintaining R-tree index in-memory with replication).
- Worker: migrate to SQS + Lambda or SQS + ECS for long tasks; publish progress to Redis or to a more cloud-native pub/sub chain with a bridge to WS.

### Key Bottlenecks to Address First
1) Per-user Redis subscribers in `websocket`: multiplex or centralize
2) High fanout from `filter-processor` per update: batch per-user messages and dedupe
3) Redis as single point: move to ElastiCache, enable clustering if keys/traffic warrant
4) Backpressure and send buffering on WS sends; drop stale updates under load

### Rough Capacity Summary (single DO droplet ~2 vCPU/4GB)
- WS connections: 5k–15k idle, 1k–3k active with moderate traffic
- Filter updates: 100–500 updates/sec if affected-user sets are small; lower with large fanout
- Worker: 5 concurrent tasks by design; SQS+Lambda scales horizontally if needed

### Recommendations for Next Steps
- Instrument metrics (P99 latencies, Redis op/sec, pub/sub lag, per-user fanout) and load test
- Introduce `replace-all` rate limits and delta updates
- Prototype SQS queue and one Lambda handler for a single job type
- Plan Redis migration to ElastiCache and introduce Redis auth + TLS

