# @realtime-markers/database

Shared database entities, migrations, and utilities for the realtime-markers project.

## Overview

This package contains all the database-related code that can be shared across different applications in the realtime-markers project:

- **Entities**: TypeORM entity definitions for all database tables
- **Migrations**: Database migration files for schema changes
- **Utilities**: Shared database utilities and data source configuration

## Installation

This package is part of the monorepo and should be installed as a dependency in other apps:

```bash
pnpm add @realtime-markers/database
```

## Usage

### Importing Entities

```typescript
import {
  User,
  Event,
  Category,
  UserRole,
  EventStatus,
} from "@realtime-markers/database";
```

### Using the Data Source

```typescript
import { AppDataSource, initializeDatabase } from "@realtime-markers/database";

// Initialize the database connection
const dataSource = await initializeDatabase();

// Use the data source for queries
const userRepository = dataSource.getRepository(User);
const users = await userRepository.find();
```

### Running Migrations

```typescript
import { runMigrations } from "@realtime-markers/database";

// Run all pending migrations
await runMigrations();
```

## Structure

```
src/
├── entities/          # TypeORM entity definitions
│   ├── User.ts
│   ├── Event.ts
│   ├── Category.ts
│   └── ...
├── migrations/        # Database migration files
│   ├── CategoryTable1710000000000.ts
│   ├── EventTable1710000000001.ts
│   └── ...
├── utils/            # Shared utilities
│   └── dataSource.ts # Data source configuration
└── index.ts          # Main exports
```

## Migration Notes

Some migrations require external services and are provided as placeholders:

- `RegenerateEmbeddings1710000000017.ts`: Requires OpenAI API and Redis
- `SeedUsers1710000000012.ts`: Requires bcrypt for password hashing

These migrations should be implemented by the consuming application with the appropriate service dependencies.

### Implementing Placeholder Migrations

For migrations that require external services, you can create your own implementations:

```typescript
// Example: Implementing the SeedUsers migration
import bcrypt from "bcrypt";

export class SeedUsers1710000000012 implements MigrationInterface {
  name = "SeedUsers1710000000012";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const saltRounds = 10;
    const userPasswordHash = await bcrypt.hash("user123", saltRounds);

    await queryRunner.query(`
      INSERT INTO users (id, email, password_hash, role, is_verified)
      VALUES ('550e8400-e29b-41d4-a716-446655440001', 'user@example.com', '${userPasswordHash}', 'USER', true)
      ON CONFLICT (email) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM users 
      WHERE email IN ('user@example.com', 'moderator@example.com', 'admin@example.com')
    `);
  }
}
```

## Development

### Building

```bash
pnpm build
```

### Development Mode

```bash
pnpm dev
```

## Dependencies

- `typeorm`: ORM for database operations
- `pg`: PostgreSQL driver
- `geojson`: GeoJSON types for location data
- `reflect-metadata`: Required for TypeORM decorators

## Peer Dependencies

- `typeorm`: Should be installed by consuming applications

## Available Entities

- `User`: User accounts and authentication
- `Event`: Events with location and metadata
- `Category`: Event categories
- `EventShare`: Event sharing functionality
- `Filter`: User filters and preferences
- `QueryAnalytics`: Analytics tracking
- `UserEventView`: Event view tracking
- `UserEventDiscovery`: Event discovery tracking
- `UserEventRsvp`: Event RSVP tracking
- `UserEventSave`: Event save tracking
- `CivicEngagement`: Civic engagement features
- `UserPushToken`: Push notification tokens

## Available Enums

- `UserRole`: USER, MODERATOR, ADMIN
- `EventStatus`: PENDING, VERIFIED, REJECTED, EXPIRED
- `RecurrenceFrequency`: DAILY, WEEKLY, BIWEEKLY, MONTHLY, YEARLY
- `DayOfWeek`: SUNDAY, MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY
