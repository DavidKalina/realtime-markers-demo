# CLAUDE.md

## Product Philosophy

- **Solve loneliness from the bottom up** — the app serves individuals trying to get out more, not a social network
- **Snow globe design** — every screen is a diorama of the user's real-world effort. Animations, colors, visual hierarchy, and data all tell the story of their progress. The app should feel like looking into a microcosm of your adventures.
- **Addicted to progress, not the app** — retention comes from making real-world action feel rewarding (streaks, badges, scores), not from infinite scroll or social comparison
- **No aggregator trap** — the differentiator is scanned ad-hoc events Google doesn't have. Don't dilute with API-imported mainstream content.

- **Semicolons required**, **double quotes** for strings (enforced by ESLint + Prettier)
- Backend handlers follow Hono's context pattern (`c.req`, `c.json()`, etc.) and use `withErrorHandling` wrapper from `utils/handlerUtils.ts`
- Services are accessed via Hono context: `c.get("serviceName")`
- Routes are mounted in `utils/routeSetup.ts` via `app.route("/api/path", router)`
- Use CORS middleware from Hono (`hono/cors`) — not custom implementations
- Database migrations live in `apps/backend/migrations/` and use TypeORM CLI
- **When adding a new entity**, update ALL of these files:
  1. `packages/database/src/entities/` — create the entity file
  2. `packages/database/src/entities/index.ts` — export the entity
  3. `packages/database/src/config/data-source.ts` — add entity to the `entities` array
  4. `packages/database/src/utils/entityUtils.ts` — add to `ENTITY_TO_TABLE_MAPPING`
  5. `apps/backend/data-source.ts` — add entity to `entities` array
- **Migrations are auto-discovered** — just create a file in `apps/backend/migrations/` and it's picked up via glob pattern. No manual registration needed.
- The app is **events + sidequests** — core entities are `Sidequest` (table: `sidequests`) and `Objective` (table: `objectives`). The old `Itinerary`/`ItineraryItem` entities have been removed.
- Sidequest generation produces **3 parallel options** via `OpenAIResponsesAgent` — parent shell + 3 child sidequests, user picks one
- Services: `SidequestService` (was ItineraryService), `SidequestCheckinService` (was ItineraryCheckinService)
- Routes: `/api/sidequests` (was /api/itineraries)
- **Do not use `runOnJS` from react-native-reanimated** — it is deprecated. Use `scheduleOnRN` from `react-native-worklets` instead to call JS functions from worklet callbacks.
