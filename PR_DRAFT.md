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

---

Title: Switch immediate per-user publishes to filtered channels in mobile format

Summary
- Changes `UnifiedMessageHandler` to publish immediate deltas to `user:{userId}:filtered-events` (and `filtered-civic-engagements`) using mobile-friendly message types (`add-event`, `update-event`, `delete-event`).
- Fixes issue where newly created events didn’t appear on mobile until viewport changed.

Rationale
- The mobile `useMapWebSocket` hook consumes `add-event`/`update-event`/`delete-event` and `replace-all` from the `filtered-events` channel.
- Previously, filter-processor published immediate updates to per-user `notifications`, which the websocket layer doesn’t forward to clients.

Details
- Updated file: `apps/filter-processor/src/services/UnifiedMessageHandler.ts`
  - Channel now selected per entity type:
    - Events → `user:{userId}:filtered-events`
    - Civic engagements → `user:{userId}:filtered-civic-engagements`
  - Payloads:
    - CREATE → `add-event` / `add-civic-engagement`
    - UPDATE → `update-event` / `update-civic-engagement`
    - DELETE → `delete-event` / `delete-civic-engagement`
  - Avoids importing external Redis types; uses a minimal publisher interface to satisfy linter.

Testing notes
- Creating an event from the dashboard should now appear on the mobile map instantly (assuming the user has identified and sent an initial viewport).
- No websocket or mobile changes required.
