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
