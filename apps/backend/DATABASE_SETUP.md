# Database Setup Guide

This document describes the streamlined database setup process that ensures all migrations have run and all tables are properly configured before services are initialized.

## Overview

The database initialization process now includes comprehensive validation to ensure:

1. **Database Connection**: PostgreSQL connection is established
2. **Migration Status**: All migrations have been run successfully
3. **Table Validation**: All required tables exist and are accessible
4. **Service Readiness**: Database is fully ready before service initialization

## Key Components

### 1. Enhanced Database Initializer (`utils/databaseInitializer.ts`)

Provides comprehensive database validation functions:

- `validateMigrations()`: Checks if all migrations have run
- `validateTables()`: Verifies all required tables exist
- `getDatabaseStatus()`: Returns complete database health status
- `ensureDatabaseReadyForServices()`: Comprehensive readiness check
- `waitForDatabaseReady()`: Waits for database to become ready with timeout

### 2. Repository Initializer (`services/RepositoryInitializer.ts`)

Now includes database readiness validation before creating repositories:

```typescript
async initialize(): Promise<RepositoryContainer> {
  // Ensures database is fully ready before creating repositories
  await ensureDatabaseReadyForServices(this.dataSource);
  // ... create repositories
}
```

### 3. Service Initializer (`services/ServiceInitializer.ts`)

Handles async repository initialization and provides better error handling.

### 4. Main Application (`index.ts`)

Enhanced initialization flow with detailed status reporting:

```typescript
async function initializeServices() {
  const dataSource = await initializeDatabase();
  await ensureDatabaseReadyForServices(dataSource);
  // ... initialize services
}
```

## Health Check Endpoint

The `/api/health` endpoint now provides detailed database status:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "db_connection": "connected",
  "database": {
    "migrations_run": true,
    "tables_ready": true,
    "last_migration": "SeedUsers1710000000012",
    "pending_migrations": [],
    "missing_tables": []
  }
}
```

## Database Setup Script

Use the database setup checker script to validate your database:

```bash
cd apps/backend
bun run scripts/check-database-setup.ts
```

This script will:

1. Test database connection
2. Check migration status
3. Validate table existence
4. Provide detailed status report
5. Give recommendations for any issues

## Required Tables

The system validates the existence of these tables:

- `users`
- `events`
- `categories`
- `event_shares`
- `filters`
- `notifications`
- `query_analytics`
- `user_event_views`
- `user_event_discoveries`
- `user_event_rsvps`
- `user_event_saves`
- `friendships`
- `migrations`

## Error Handling

The system provides clear error messages for common issues:

- **Connection Failed**: Database connection cannot be established
- **Migrations Pending**: Some migrations haven't been run
- **Missing Tables**: Required tables don't exist
- **Service Initialization**: Services cannot be created until database is ready

## Development Workflow

1. **Start Database**: Ensure PostgreSQL is running
2. **Run Migrations**: Use TypeORM migration commands
3. **Validate Setup**: Run the database setup checker
4. **Start Application**: The app will validate everything before starting

## Troubleshooting

### Common Issues

1. **"Database migrations have not been run"**

   - Solution: Run `bun run migration:run` or equivalent

2. **"Required tables are missing"**

   - Solution: Check if migrations ran successfully
   - Verify database connection and permissions

3. **"Database is not initialized"**
   - Solution: Check database connection string
   - Verify PostgreSQL is running

### Debug Commands

```bash
# Check database setup
bun run scripts/check-database-setup.ts

# Check health endpoint
curl http://localhost:3000/api/health

# View logs for detailed error messages
tail -f logs/app.log
```

## Benefits

- **Reliability**: Services won't start until database is fully ready
- **Debugging**: Clear error messages and status reporting
- **Monitoring**: Health endpoint provides detailed database status
- **Development**: Easy setup validation and troubleshooting
- **Production**: Robust initialization with proper error handling
