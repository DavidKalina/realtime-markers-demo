# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Product framing: "Track how much you touch grass."**

This is a **personal adventure app** that helps introverts and planners discover things to do, plan outings, and track their real-world progress. The core loop: **Discover → Plan → Go → Check-in → Progress → Discover more.** It is a **pnpm monorepo** with 5 apps and 1 shared package. All backend services use **Bun** as the runtime.

The codebase is **events-only**. Do not add new content types (volunteering, national parks, etc.) without explicit product direction.

## The Core Loop

1. **Discover** — Scan flyers with camera (GPT-4o vision extracts event data), browse real-time map markers, area-scan a zone for spatial clustering insights, or search events
2. **Plan** — Drop up to 3 anchor pins on the map, AI generates a multi-stop itinerary with timing, costs, venue details, weather forecast, and pro tips
3. **Go** — Activate an itinerary as your "active quest"; AdventureHUD shows current/next stops on the map with route visualization
4. **Check-in** — Geofenced proximity check-in (75m radius) or manual; each stop awards XP with celebration animation
5. **Progress** — XP accumulates toward tier progression, weekly streaks track consistency, category expertise badges unlock, personal adventure score grows, and city-level Third Space Scores reflect community activity
6. **Discover more** — Progress unlocks new tiers and badges, nudge notifications encourage continued exploration

## Product Philosophy

- **Solve loneliness from the bottom up** — the app serves individuals trying to get out more, not a social network
- **Snow globe design** — every screen is a diorama of the user's real-world effort. Animations, colors, visual hierarchy, and data all tell the story of their progress. The app should feel like looking into a microcosm of your adventures.
- **Addicted to progress, not the app** — retention comes from making real-world action feel rewarding (streaks, badges, scores), not from infinite scroll or social comparison
- **Three pillars**: Discovery (scan, area scan, city scores) → Planning (itinerary builder) → Progress (game loop)
- **No aggregator trap** — the differentiator is scanned ad-hoc events Google doesn't have. Don't dilute with API-imported mainstream content.

## Current Priorities

1. **Game loop polish** — the XP/tier/streak/badge system exists but needs refinement and deeper integration into the UX
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

### Real-Time Pipeline

1. Mobile camera → **Backend** (`ProcessFlyerHandler`) → GPT-4o vision → PostgreSQL (`events` table)
2. Backend publishes `event:created` → **Redis pub/sub**
3. **Filter Processor** subscribes Redis → updates RBush spatial cache → finds affected users by viewport intersection → publishes batch updates to `user:{userId}:filtered-events`
4. **WebSocket server** subscribes per-user channels → transforms batches into mobile-friendly messages (add/update/delete/replace-all) → sends to connected clients

Per-user WebSocket channels follow the pattern `user:{userId}:filtered-events`. Viewport updates are debounced (25ms) to reduce Redis traffic.

### Key Technologies

- **Database:** PostgreSQL + PostGIS (geospatial) + pgvector (embeddings)
- **Cache/Pub-Sub:** Redis (ioredis)
- **Spatial Indexing:** RBush (in-memory, used in websocket and filter-processor)
- **ORM:** TypeORM (shared via `packages/database`)
- **AI:** OpenAI (GPT-4o for flyer extraction + itinerary generation, text-embedding-3-small for vectors)
- **Reverse Proxy:** Traefik with Let's Encrypt SSL
- **Auth:** JWT + OAuth (Google, Facebook)

### Backend (`apps/backend/`)

Hono HTTP server. Organized as:

- `handlers/` — HTTP request handlers (including `job/ProcessFlyerHandler` for AI flyer processing, `job/GenerateItineraryHandler` for AI itinerary creation)
- `routes/` — Route definitions (auth, events, itineraries, places, leaderboard, filters, area-scan, users, categories, push-notifications, jobs, rituals, admin)
- `services/` — Business logic & DB access; `ServiceInitializer.ts` wires all services via dependency injection
- `middleware/` — Auth, admin, CORS, rate limiting, security headers, performance monitoring
- `migrations/` — TypeORM migration files (~36 migrations)

**Key service categories:**
- **Event services:** EventService, EventProcessingService, EventSearchService, EventLifecycleService
- **Itinerary services:** ItineraryService, ItineraryCheckinService (proximity check-ins, streak tracking, XP awards, milestone bonuses)
- **Gamification services:** GamificationService (XP/tiers), BadgeService (category expertise badges), AdventureScoreService
- **Leaderboard services:** LeaderboardService (weekly city rankings), ThirdSpaceScoreService (city activity scores)
- **Notification services:** PushNotificationService, DiscoveryNotificationService, ProximityNotificationService
- **Shared services:** OpenAIService, EmbeddingService, GoogleGeocodingService, OverpassService (OSM trails), WeatherService, StorageService (DO Spaces), RedisService, EmailService (Resend)

**Scheduled jobs** (configured in `ServiceInitializer.ts`):
- Daily event cleanup (expired events)
- Ticketmaster import (opt-in, 6-hour intervals)
- Third Space Score computation (every 4 hours)
- Streak-at-risk notifications (Sundays 6pm UTC)
- Weekly nudge for users without upcoming plans (Thursdays 6pm UTC)

Integrations: OpenAI (GPT-4o for flyer extraction + itinerary generation), Resend (email), Expo push notifications, AWS/DO Spaces (file storage), Google Places API, OpenStreetMap Overpass API, Ticketmaster (opt-in import).

### WebSocket (`apps/websocket/`)

Manages live client connections. Key services:

- `ClientConnectionService` — WebSocket lifecycle, zombie cleanup (5 min idle), transforms batch updates to mobile messages
- `RedisService` — Pub/sub for `event:created/updated/deleted` and per-user filtered events, debounced viewport publishing
- Tracks client type (web vs mobile). Per-user channels: `user:{userId}:filtered-events`.

### Filter Processor (`apps/filter-processor/`)

Background service; subscribes to Redis channels and processes per-user spatial/vector filtering queries. Key services:

- `UnifiedMessageHandler` — routes entity changes to affected users via viewport intersection
- `UnifiedSpatialCacheService` — RBush-backed in-memory spatial cache (events only, max 10k)
- `HybridUserUpdateBatcherService` — debounce/sweep-based batching for viewport updates
- `RelevanceScoringService` — scores events by recency, popularity, category match, trending
- Exposes health check on port 8082.

### Web Dashboard (`apps/web-dashboard/`)

Next.js 14 App Router. Uses Mapbox GL for map visualization, Recharts for analytics, Radix UI + Tailwind for components. Pages: dashboard (metrics/analytics), events map, events table, user management, LLM cost tracking, public itinerary share viewer (`/i/[shareToken]`).

### Mobile App (`apps/mobile-app/`)

Expo Router with `app/` directory for screens. Uses `@rnmapbox/maps`, Zustand stores, and Expo modules (camera, location, haptics, notifications).

**Screens:**
- `index` — Map home. Two modes: "explore" (discovery markers) and "itinerary" (active quest with AdventureHUD). Long-press to drop anchor pins for planning. FABs for recenter, category filter, area scan, job status, mode toggle.
- `scan` — Camera flyer scanning with guide rail overlay, auto-crop, flash toggle, gallery picker. Processing overlay shows GPT-4o extraction progress via SSE.
- `itineraries/index` — Swipeable itinerary list with active indicator, generation status (animated emoji reel), pull-to-search, infinite scroll.
- `itineraries/[id]` — Itinerary detail with animated hero stats, timeline view of stops (check-in times, descriptions, pro tips, "why this stop"), map preview, activate/rate/share actions.
- `spaces/index` — City Third Space Scores browsed by "Top Rated" or "Nearest". Shows rank, score, momentum (rising/steady/cooling).
- `spaces/[city]` — City detail with score breakdown (activity, follow-through, variety, satisfaction, community), score history chart, contributor leaderboard, activity DNA.
- `user` — Profile with XP progress bar, tier badge, stats card (categories/cities/rank), streak banner, badge grid, recent completions, adventure score, theme toggle.
- `area-scan` — Zone intelligence with category DNA breakdown, encounter list, streaming insights via SSE dialog box.
- `search`, `saved`, `details`, `cluster`, `category/[id]` — Event browsing, bookmarks, detail views.
- `login`, `register`, `onboarding`, `forgot-password`, `reset-password` — Auth screens with Google/Facebook OAuth.

**Key Zustand stores:** `useActiveItineraryStore` (active quest state), `useAnchorPlanStore` (planning pins, max 3), `useXPStore` (pending XP/level-ups/badges), `useMapModeStore` (explore vs itinerary), `useLocationStore` (markers, selection, viewport, WebSocket status), `useFilterStore` (category preferences), `useItineraryJobStore` (generation tracking).

**Key hooks:** `useMapWebSocket` (real-time viewport filtering), `useEventSearch`, `useSavedEvents`, `useThirdSpaces`, `useUserStats`, `useLeaderboard`, `useCameraFollowMode`, `useItineraryReveal` (progressive waypoint reveal on map).

### Shared Database Package (`packages/database/`)

Exports TypeORM entities and TypeScript types consumed by backend, websocket, and filter-processor. The only map marker type is `EventMarker`.

**Core entities (18 total):**
- `User` — Auth, gamification fields (totalXp, currentTier, currentStreak, longestStreak, weeklyScanCount), activity counts, onboardingProfile (JSON), preferenceEmbedding, activeItineraryId
- `Event` — Title, description, emoji, PostGIS location, dates, recurrence rules, status (PENDING/VERIFIED/REJECTED/EXPIRED), engagement counts, QR code data, embedding (pgvector), source (SCAN/TICKETMASTER)
- `Category` — Name, description, icon. M2M with events and itinerary items.
- `Itinerary` — City, title, summary, plannedDate, status (GENERATING/READY/FAILED), budget range, durationHours, activityTypes, intention, forecast (JSON), rating, shareToken, isPublished, timesAdopted
- `ItineraryItem` — startTime/endTime (HH:mm), sortOrder, title, description, emoji, venue details (name, address, googlePlaceId, googleRating), estimatedCost, whyThisStop, proTip, embedding, checkedInAt
- `ItineraryCheckin` — userId, itineraryId, itemId, user location at check-in, distanceMeters, source (proximity/manual)
- `ItineraryRitual` — Reusable itinerary templates (name, emoji, stops, budget, activities)
- `UserBadge` — Badge tracking with progress + unlock timestamp
- `UserEventDiscovery`, `UserEventSave`, `UserEventView`, `UserEventRsvp` — Engagement junction tables
- `UserFollow` — Follow relationships (deprioritized)
- `UserPushToken` — Device push tokens
- `Filter` — Semantic filters with embeddings + criteria JSON
- `QueryAnalytics` — Search analytics tracking
- `LlmUsageLog` — API cost tracking

## Gamification System

### Tier Progression (XP-based)
- **Explorer**: 0 XP (starting tier)
- **Scout**: 500 XP
- **Curator**: 2,000 XP
- **Ambassador**: 5,000 XP

Implemented in `apps/mobile-app/utils/gamification.ts` (client) and `apps/backend/services/GamificationService.ts` (server).

### XP Awards
- Itinerary completion: primary XP event (100-500 base)
- Per-stop check-in: XP per stop
- Event scan: smaller XP reward
- Itinerary rating: bonus XP
- Milestone bonuses at streak milestones (3, 7, 12, 26, 52 weeks)

### Streaks
- Weekly check-in streaks tracked in `User.currentStreak` / `User.longestStreak`
- Streak-at-risk push notifications sent Sundays
- Managed by `ItineraryCheckinService`

### Badges
- Category expertise badges (e.g., "Coffee Connoisseur", "Night Owl", "Foodie", "Trail Blazer")
- Progress-based unlocking tracked in `UserBadge` entity
- Managed by `BadgeService`

### Adventure Score & Third Space Score
- **Adventure Score**: Personal aggregate of all activity (managed by `AdventureScoreService`)
- **Third Space Score**: Per-city score with 5 dimensions — activity, follow-through, variety, satisfaction, community. Computed every 4 hours by `ThirdSpaceScoreService`. Displayed in the Spaces tab.

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
- Backend handlers follow Hono's context pattern (`c.req`, `c.json()`, etc.) and use `withErrorHandling` wrapper from `utils/handlerUtils.ts`
- Services are accessed via Hono context: `c.get("serviceName")`
- Routes are mounted in `utils/routeSetup.ts` via `app.route("/api/path", router)`
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
- Mobile API modules extend `BaseApiModule` and are lazy-loaded via the `ApiClient.ts` singleton
- Mobile state management uses Zustand stores in `apps/mobile-app/stores/`
