# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Product framing: "Track how much you touch grass."**

This is a **personal adventure app** that helps introverts and planners discover things to do, plan outings, and track their real-world progress. The core pipeline: **Discover → Plan → Go → Check-in → Progress → Discover more.** It is a **pnpm monorepo** with 5 apps and 1 shared package. All backend services use **Bun** as the runtime.

The codebase is **events-only**. Do not add new content types (volunteering, national parks, etc.) without explicit product direction.

## Product Philosophy

- **Solve loneliness from the bottom up** — the app serves individuals trying to get out more, not a social network
- **Snow globe design** — every screen is a diorama of the user's real-world effort. Animations, colors, visual hierarchy, and data all tell the story of their progress. The app should feel like looking into a microcosm of your adventures.
- **Addicted to progress, not the app** — retention comes from making real-world action feel rewarding (streaks, badges, scores), not from infinite scroll or social comparison
- **Three pillars**: Discovery (scan, area scan, city scores) → Planning (itinerary builder) → Progress (game loop)
- **No aggregator trap** — the differentiator is scanned ad-hoc events Google doesn't have. Don't dilute with API-imported mainstream content.

## Current Priorities

1. **Game loop** — streaks, category-themed expertise badges, personal adventure score. This is the #1 gap.
2. **Polish existing features** — tighten the discovery→planning→progress pipeline, refine UI/UX
3. **Do NOT build**: new content types, social feed, competitive leaderboards, monetization features, B2B tooling

## Common Commands

### Local Development (Everything)

```bash
pnpm dev:local            # Docker + ngrok + Expo (physical device ready)
pnpm dev:local:no-ngrok   # Docker + Expo (simulator only, no ngrok)
```

### Development (Docker-based)

```bash
pnpm docker:prod         # Start with production config
pnpm docker:down         # Stop all services
```

### Logs & Debugging

```bash
pnpm logs                # All service logs
pnpm logs:backend        # Backend logs only
pnpm logs:websocket      # WebSocket logs only
pnpm logs:filter         # Filter processor logs only
pnpm shell:backend       # Shell into backend container
```

### Code Quality

```bash
pnpm lint                # ESLint across all packages
pnpm format              # Prettier formatting
pnpm test                # Run tests across all apps (Bun test runner)
```

### Database

```bash
pnpm db:migrate          # Run TypeORM migrations
pnpm db:seed             # Seed initial data
pnpm db:reset            # Drop and recreate database

# Inside the backend container:
docker compose exec backend pnpm migration:run
docker compose exec backend pnpm migration:create
docker compose exec backend pnpm migration:generate
docker compose exec backend pnpm migration:revert
```

## Architecture

### Monorepo Structure

```
apps/
  backend/          # REST API (Hono + Bun)
  websocket/        # Real-time WebSocket server (Bun)
  filter-processor/ # Spatial filtering background service (Bun)
  web-dashboard/    # Admin dashboard (Next.js 14 App Router)
  mobile-app/       # Cross-platform mobile (Expo + React Native)
packages/
  database/         # Shared TypeORM entities, data source, types
```

### Scan → Map Pipeline

1. Mobile camera → **Backend** (`ProcessFlyerHandler`) → gpt-4o vision → PostgreSQL (`events` table)
2. Backend publishes `event:created` → **Redis pub/sub**
3. **WebSocket server** subscribes Redis → broadcasts to connected clients (viewport-filtered via RBush)
4. **Filter Processor** subscribes Redis → handles per-user spatial queries and vector embeddings

Per-user WebSocket channels follow the pattern `user:{userId}:filtered-events`.

### Key Technologies

- **Database:** PostgreSQL + PostGIS (geospatial) + pgvector (embeddings)
- **Cache/Pub-Sub:** Redis (ioredis)
- **Spatial Indexing:** RBush (in-memory, used in websocket and filter-processor)
- **ORM:** TypeORM (shared via `packages/database`)
- **Reverse Proxy:** Traefik with Let's Encrypt SSL
- **Auth:** JWT + OAuth (Google, Facebook)

### Backend (`apps/backend/`)

Hono HTTP server. Organized as:

- `handlers/` — HTTP request handlers (including `job/ProcessFlyerHandler` for AI flyer processing)
- `routes/` — Route definitions
- `services/` — Business logic & DB access; `ServiceInitializer.ts` wires all services via dependency injection
- `middleware/` — Auth, CORS, rate limiting
- `migrations/` — TypeORM migration files

Integrations: OpenAI (gpt-4o for flyer extraction), Resend (email), Expo push notifications, AWS/DO Spaces (file storage).

### WebSocket (`apps/websocket/`)

Manages live client connections. Uses RBush for viewport-based filtering — clients only receive updates for markers within their visible map bounds. Tracks client type (web vs mobile). Per-user channels: `user:{userId}:filtered-events`.

### Filter Processor (`apps/filter-processor/`)

Background service; subscribes to Redis channels and processes per-user spatial/vector filtering queries. Key services:

- `UnifiedMessageHandler` — routes entity changes to affected users
- `UnifiedSpatialCacheService` — RBush-backed in-memory spatial cache (events only)
- `HybridUserUpdateBatcherService` — debounce/sweep-based batching for viewport updates
- `EntityTypeConfigs` — registry of supported entity types (events only)
- Exposes health check on port 8082.

### Web Dashboard (`apps/web-dashboard/`)

Next.js 14 App Router. Uses Mapbox GL for map visualization, Recharts for analytics, Radix UI + Tailwind for components. Shows events map and analytics only.

### Mobile App (`apps/mobile-app/`)

Expo Router with `app/` directory for screens. Uses `@rnmapbox/maps`, Zustand stores, and Expo modules (camera, location, haptics, notifications). Core screens: `index` (map), `scan` (camera → flyer processing), `itineraries` (plan & track adventures), `spaces` (city scores), `area-scan`, `search`, `saved`, `user`. The itinerary system is the centerpiece — AI-generated plans with geofenced check-ins, completion tracking, ratings, rituals, and sharing.

### Shared Database Package (`packages/database/`)

Exports TypeORM entities (`Event`, `User`, `Category`, etc.), the shared `DataSource`, and TypeScript types consumed by backend, websocket, and filter-processor. The only map marker type is `EventMarker`.

## Docker Infrastructure

All services run inside Docker via `docker-compose.yml`. Environment-specific overrides:

- `docker-compose.http.yml` — HTTP-only (no Traefik), direct port access
- `docker-compose.local.yml` — local dev overlay (dashboard hot reload + localhost URLs)
- `docker-compose.prod.yml` — production

All services communicate over the `marker-network` bridge. Environment variables are configured via `.env` (see `env.example`).

## CI/CD

GitHub Actions workflows on PRs:

- **`lint.yml`** — ESLint + checks for disallowed `any` types (Node 20, pnpm v8)
- **`test.yml`** — Bun test runner for backend, websocket, filter-processor

## Conventions

- **Semicolons required**, **double quotes** for strings (enforced by ESLint + Prettier)
- Backend handlers follow Hono's context pattern (`c.req`, `c.json()`, etc.)
- Use CORS middleware from Hono (`hono/cors`) — not custom implementations
- Database migrations live in `apps/backend/migrations/` and use TypeORM CLI
- **When adding a new entity or migration**, update ALL of these files:
  1. `packages/database/src/entities/` — create the entity file
  2. `packages/database/src/entities/index.ts` — export the entity
  3. `packages/database/src/config/data-source.ts` — add entity to the `entities` array
  4. `packages/database/src/utils/entityUtils.ts` — add to `ENTITY_TO_TABLE_MAPPING`
  5. `apps/backend/data-source.ts` — add entity to `entities` array AND migration to `migrations` array
- The app is **events-only** — do not add new entity types (e.g. civic engagements, private events) without explicit product direction
- **Do not use `runOnJS` from react-native-reanimated** — it is deprecated. Use `scheduleOnRN` from `react-native-worklets` instead to call JS functions from worklet callbacks.
- **Itinerary completion is the primary XP event** — check-ins and completions should be the biggest XP rewards, not scanning
- **No social features** — following/social feed is deprioritized. Do not invest in social graph features.
- **Game loop elements** (streaks, badges, adventure score) should reward real-world action, not app usage
