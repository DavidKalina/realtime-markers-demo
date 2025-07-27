# @realtime-markers/database

Shared database package for the Realtime Markers project. This package contains all database entities, types, and configuration that can be used across different applications in the monorepo.

## Features

- **Entities**: All TypeORM entities (User, Event, Category, etc.)
- **Types**: Common types and enums used across the application
- **Data Source**: Shared database configuration and initialization utilities
- **Migrations**: Database migration files (managed by the backend)

## Usage

### Installing the package

This package is part of the monorepo and can be used by other packages:

```bash
# From the root of the monorepo
pnpm add @realtime-markers/database
```

### Using entities and types

```typescript
import { User, Event, EventStatus, UserRole } from "@realtime-markers/database";

// Use entities and enums
const user = new User();
user.role = UserRole.ADMIN;

const event = new Event();
event.status = EventStatus.PENDING;
```

### Using the data source

```typescript
import { initializeDatabase } from "@realtime-markers/database";

// Initialize the database
const dataSource = await initializeDatabase(process.env.DATABASE_URL);

// Use the data source for queries
const userRepository = dataSource.getRepository(User);
const users = await userRepository.find();
```

## Structure

```
src/
├── entities/          # All TypeORM entities
│   ├── User.ts
│   ├── Event.ts
│   ├── Category.ts
│   └── ...
├── types/            # Common types and enums
│   └── index.ts
├── config/           # Database configuration
│   └── data-source.ts
└── index.ts          # Main entry point
```

## Development

### Building the package

```bash
cd packages/database
pnpm build
```

### Watching for changes

```bash
cd packages/database
pnpm dev
```

## Dependencies

- `typeorm`: ORM for database operations
- `pg`: PostgreSQL driver
- `pgvector`: Vector extension for embeddings
- `geojson`: Geographic data types
- `reflect-metadata`: Required for TypeORM decorators

## Notes

- Migrations are managed by the backend application
- This package focuses on entities and types that can be shared across applications
- The data source configuration can be used by any application that needs database access
