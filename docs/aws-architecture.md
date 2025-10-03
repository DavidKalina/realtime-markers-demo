## Proposed Distributed Architecture on AWS

### Goals
- Horizontally scale `websocket` and `filter-processor`
- Replace Redis list-based worker with SQS-based job pipeline
- Keep latency low for real-time updates; maintain developer ergonomics

### Components
- Networking and ingress
  - Amazon Route 53: DNS
  - AWS Certificate Manager: TLS certs
  - Application Load Balancer (ALB): HTTP and WebSocket ingress
  - Optional: Amazon CloudFront for static assets and API caching where safe

- Data plane
  - Amazon RDS for PostgreSQL (Multi-AZ)
  - Amazon ElastiCache for Redis (replication group; optional cluster mode)
  - Amazon S3 for object storage (images, buffers, artifacts)

- Compute plane
  - Backend API (Bun + Hono): AWS ECS on Fargate behind ALB
  - Websocket service: AWS ECS on Fargate with sticky sessions enabled on ALB target group; scale on active connections and CPU
  - Filter-processor: AWS ECS on Fargate; scale on CPU and custom CloudWatch metric (processed updates/sec)
  - Worker pipeline: SQS + Lambda for short tasks; SQS + ECS service for longer/CPU-heavy tasks

- Messaging and events
  - Amazon SQS Standard queue(s): per job type (e.g., `jobs-image`, `jobs-embeddings`, `jobs-cleanup`)
  - Amazon EventBridge (optional): orchestration and fanout for non-WS consumers

### Service-by-Service Mapping
- Backend API
  - Containerize as today; env configured via SSM Parameter Store/Secrets Manager
  - Uses RDS and ElastiCache Redis; public via ALB

- Websocket
  - ECS Fargate service with autoscaling
  - Keep stateless design; maintain in-memory `clients` per instance
  - All per-user notifications published to Redis pub/sub on ElastiCache
  - ALB target group configured for TCP/WebSocket and sticky sessions (duration 1–5 minutes)
  - Scale by: active connections per task, CPU, and outgoing messages/sec

- Filter-processor
  - ECS Fargate service with autoscaling
  - Read user viewports and GEO index from ElastiCache Redis
  - Optionally partition workload:
    - By userId hash range per task
    - Or run identical replicas with idempotent publish; guard with per-message keys to dedupe
  - Custom metrics: affected users/update, publishes/sec, Redis ops/sec

- Worker replacement
  - Replace `jobs:pending` list with SQS queue(s)
  - Job producer: modify `JobQueue.enqueue` to
    - Store payload in S3 (for buffers)
    - Write job metadata to DynamoDB or Redis (transient)
    - Send SQS message { jobId, type, pointers }
  - Consumers:
    - Lambda for short/IO-bound tasks (<= 15 min). VPC-enabled for Redis/RDS access
    - ECS service for heavy/long tasks (OpenAI/image/embedding pipelines). Pull from SQS with long polling
  - Progress: consumers POST progress to backend endpoint which republishes to `websocket:job_updates` on Redis, or write to Redis directly if VPC access is enabled
  - DLQ: per-queue DLQs with CloudWatch alarms

### Redis Migration Considerations
- Move to ElastiCache Redis with auth and TLS
- Consolidate per-user subscribers: consider a single multiplexed consumer per `websocket` task, or switch to pattern subscriptions with server-side filtering
- Evaluate Redis Cluster if memory or CPU becomes a bottleneck; ensure key distribution aligns (e.g., hash tags for user-scoped keys: `{user:<id>}:...`)

### Security and Config
- Secrets in AWS Secrets Manager; app configs in SSM Parameter Store
- Task roles for ECS, execution roles for pulling images/secrets
- VPC: private subnets for services; NAT for egress; public subnets for ALB only
- Security groups: least-privilege between ECS tasks, RDS, and ElastiCache

### Observability
- CloudWatch metrics/dashboards: WS connections, messages/sec, Redis ops/sec, SQS depth, Lambda/ECS concurrency
- Logs: FireLens/CloudWatch Logs; structure logs JSON
- Tracing: X-Ray or OpenTelemetry to AWS Distro for OTEL

### Cost/Scaling Notes
- Start with small Fargate tasks (e.g., 0.5 vCPU/1GB) and scale out
- SQS and Lambda are pay-per-use; ECS for long-running consumers may be cheaper for steady load
- RDS Multi-AZ for production reliability

### Migration Plan (Phased)
1) Lift-and-shift: move Postgres to RDS, Redis to ElastiCache; run current containers on ECS Fargate behind ALB
2) Replace worker queue with SQS + one Lambda consumer for a single job type; keep Redis progress bridge
3) Introduce autoscaling for `websocket` and `filter-processor`; add sticky sessions and metrics
4) Optimize per-user subscription model and batch updates; evaluate sharding for filter-processor
5) Expand SQS/Lambda/ECS consumers per job type; add DLQs and alarms

### Minimal Code Changes Required
- `JobQueue.enqueue` and worker: add SQS producer and consumer handlers
- Websocket: no API change; ensure ALB stickiness and Redis pub/sub endpoints point to ElastiCache
- Filter-processor: make publish idempotent and optionally enable batch processing configs

