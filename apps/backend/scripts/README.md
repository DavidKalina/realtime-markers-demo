# Backend Scripts

This directory contains utility scripts for the backend application.

## Available Scripts

### `check-database-setup.ts`

**Purpose**: Comprehensive database validation and setup checker

**Usage**:

```bash
bun run check-db
# or
bun run scripts/check-database-setup.ts
```

**What it does**:

- Tests database connection
- Validates migration status
- Checks for required tables
- Provides detailed status report
- Helps troubleshoot database issues

**Output**: Detailed console output showing database health status

### `test-email.ts`

**Purpose**: Test email service functionality

**Usage**:

```bash
bun run test:email
# or
bun run scripts/test-email.ts
```

**What it does**:

- Tests mock email service (no API key required)
- Tests real email service if RESEND_API_KEY is available
- Validates email service configuration

**Requirements**:

- Optional: `RESEND_API_KEY` environment variable for real email testing

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
- `friendships.user_id` → `users.id`
- `friendships.friend_id` → `users.id`

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
