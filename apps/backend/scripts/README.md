# Backend Scripts

This directory contains utility scripts for the backend application.

## Available Scripts

### `check-database-setup.ts`

Validates that the database is properly configured and ready for use.

**Usage:**

```bash
bun run apps/backend/scripts/check-database-setup.ts
```

**What it does:**

- Checks database connection
- Validates migrations have been run
- Ensures all required tables exist
- Reports overall database readiness

### `test-email.ts`

Tests the email service configuration and sends a test email.

**Usage:**

```bash
bun run apps/backend/scripts/test-email.ts
```

**What it does:**

- Validates email service configuration
- Sends a test email to verify functionality
- Reports success or failure

### `generate-seeded-event-embeddings.ts`

Generates embeddings for the seeded official events from the migration.

**Usage:**

```bash
bun run apps/backend/scripts/generate-seeded-event-embeddings.ts
```

**What it does:**

- Connects to the database and Redis
- Fetches the 7 seeded official events from the `SeedOfficialEvents1710000000016` migration
- Generates embeddings for each event using the same format as the EventProcessingService
- Updates the events in the database with the generated embeddings
- Skips events that already have embeddings

**Prerequisites:**

- Database must be running and accessible
- Redis must be running and accessible
- OpenAI API key must be configured (`OPENAI_API_KEY` environment variable)
- The seeded events migration must have been run

**Seeded Events:**

- Frederick In Flight (🎈)
- Chainsaws & Chuckwagons (🪓)
- Miners Day (⛏️)
- Tiny Terror Town (👻)
- Festival of Lights (🎄)
- Community Tour & Talk (🗣️)
- Carbon Valley Memorial Day Ceremony (🇺🇸)

**Environment Variables:**

- `OPENAI_API_KEY` - Required for embedding generation
- `REDIS_HOST` - Redis host (default: "redis")
- `REDIS_PORT` - Redis port (default: "6379")
- `REDIS_PASSWORD` - Redis password (optional)

## Running Scripts

All scripts can be run using Bun:

```bash
# From the project root
bun run apps/backend/scripts/<script-name>.ts

# Or from the backend directory
cd apps/backend
bun run scripts/<script-name>.ts
```

## Adding New Scripts

When adding new scripts:

1. Create the script file in this directory
2. Add a shebang line: `#!/usr/bin/env bun`
3. Make it executable: `chmod +x <script-name>.ts`
4. Update this README with documentation
5. Follow the existing patterns for error handling and logging
6. Ensure proper cleanup of resources (database connections, Redis connections, etc.)

## Package.json Scripts

The following npm scripts are available in the root package.json:

- `check-db`: Runs the database setup checker
- `test:email`: Runs the email service test
- `migration:run`: Runs database migrations
- `migration:generate`: Generates new migrations
- `migration:revert`: Reverts the last migration

## Recent Migration Fix

A comprehensive migration dependency issue was recently fixed:

**Problem**: Multiple migrations were trying to create foreign key constraints to the `users` table before the `users` table existed:

- `EventTable1710000000001` (timestamp: 1710000000001)
- `EventShareTable1710000000002` (timestamp: 1710000000002)
- `FilterTable1710000000003` (timestamp: 1710000000003)
- `NotificationTable1710000000004` (timestamp: 1710000000004)
- `UserTable1710000000006` (timestamp: 1710000000006) - creates users table

**Solution**:

1. Removed all foreign key constraints to the `users` table from migrations that run before the UserTable migration
2. Created a comprehensive migration `AddAllUserForeignKeys1710000000014` that adds all foreign key constraints after the users table exists
3. This ensures proper migration order and prevents dependency conflicts

**Tables Fixed**:

- `events.creator_id` → `users.id`
- `event_shares.shared_with_id` → `users.id`
- `event_shares.shared_by_id` → `users.id`
- `filters.user_id` → `users.id`
- `notifications.userId` → `users.id`
- `user_event_discoveries.user_id` → `users.id`
- `user_event_rsvps.user_id` → `users.id`
- `user_event_saves.user_id` → `users.id`
- `user_event_views.user_id` → `users.id`

## Removed Scripts

The following scripts were removed to reduce confusion:

- `check-database.ts` - Replaced by `check-database-setup.ts`
- `run-migrations.ts` - Redundant with TypeORM CLI commands
- `seed-users.ts` - Seeding now handled automatically
- `test-openai.ts` - Empty file
- `regenerate-embeddings.ts` - One-time migration script
- `migrate-emoji-descriptions.ts` - One-time migration script
- `update-users-to-pro.ts` - One-time migration script

## Development Workflow

1. **Database Setup**: Use `bun run check-db` to validate database
2. **Email Testing**: Use `bun run test:email` to test email functionality
3. **Migrations**: Use `bun run migration:run` for database changes
