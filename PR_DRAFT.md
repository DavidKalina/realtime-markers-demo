Title: Architecture audit and proposed AWS distributed design

Summary
- Adds `docs/audit.md` reviewing current single-node setup and estimating scale for `websocket` and `filter-processor`
- Adds `docs/aws-architecture.md` proposing an AWS architecture using ECS Fargate, ElastiCache, RDS, and SQS (+ Lambda/ECS consumers)

Motivation
- Prepare the codebase and infrastructure for horizontal scale, reduce single-node bottlenecks, and adopt managed AWS services for reliability and elasticity

Key Points
- Websocket: horizontally scalable with ALB sticky sessions; keep pub/sub on ElastiCache; address per-user subscriber fanout
- Filter-processor: consider sharding and batching; move viewport store and GEO index to ElastiCache
- Worker: migrate to SQS producers/consumers; Lambda for short tasks and ECS for heavier/longer tasks; progress bridged to Redis for WS updates

Next Steps
- Instrument metrics and perform load tests
- Prototype SQS + single Lambda consumer for one job type
- Plan Redis migration and ALB/WebSocket stickiness

Files Added
- docs/audit.md
- docs/aws-architecture.md
