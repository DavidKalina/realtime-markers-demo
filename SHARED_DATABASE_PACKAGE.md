# Shared Database Package

## What Was Created

I've successfully created a shared database package at `packages/database/` that contains all the database entities, migrations, and utilities that can be used across all applications in your realtime-markers project.

### Package Structure

```
packages/database/
├── package.json           # Package configuration with dependencies
├── tsconfig.json          # TypeScript configuration
├── README.md             # Documentation
├── src/
│   ├── index.ts          # Main exports
│   ├── entities/         # All TypeORM entities
│   │   ├── User.ts
│   │   ├── Event.ts
│   │   ├── Category.ts
│   │   └── ... (all other entities)
│   ├── migrations/       # All database migrations
│   │   ├── CategoryTable1710000000000.ts
│   │   ├── EventTable1710000000001.ts
│   │   └── ... (all other migrations)
│   └── utils/
│       └── dataSource.ts # Shared data source configuration
└── dist/                 # Compiled JavaScript output
```

### Key Features

1. **Shared Entities**: All TypeORM entity definitions are now centralized
2. **Shared Migrations**: Database migration files are available to all apps
3. **Shared Data Source**: Common database connection and initialization logic
4. **Type Safety**: Full TypeScript support with proper type definitions
5. **Workspace Integration**: Uses pnpm workspace for local package management

## How to Use

### 1. Add as Dependency

In any app that needs database access, add the package as a dependency:

```json
{
  "dependencies": {
    "@realtime-markers/database": "workspace:*"
  }
}
```

### 2. Import and Use

```typescript
// Import entities
import {
  User,
  Event,
  Category,
  UserRole,
  EventStatus,
} from "@realtime-markers/database";

// Import data source utilities
import { AppDataSource, initializeDatabase } from "@realtime-markers/database";

// Initialize database
const dataSource = await initializeDatabase();

// Use repositories
const userRepository = dataSource.getRepository(User);
const users = await userRepository.find();
```

### 3. Update Existing Apps

The backend app has been updated to use the shared package. You can update other apps similarly:

- Replace local entity imports with shared package imports
- Use the shared data source configuration
- Remove duplicate entity definitions

## Migration Handling

Some migrations require external services and are provided as placeholders:

- `RegenerateEmbeddings1710000000017.ts`: Requires OpenAI API and Redis
- `SeedUsers1710000000012.ts`: Requires bcrypt for password hashing

These migrations should be implemented by consuming applications with the appropriate service dependencies.

## Benefits

1. **Code Reuse**: No more duplicating entity definitions across apps
2. **Consistency**: All apps use the same database schema and types
3. **Maintainability**: Changes to entities only need to be made in one place
4. **Type Safety**: Shared TypeScript types across all applications
5. **Migration Management**: Centralized migration handling

## Next Steps

1. **Update Other Apps**: Add the shared database package to other apps in your monorepo
2. **Remove Duplicates**: Remove local entity definitions from apps that now use the shared package
3. **Implement Placeholder Migrations**: Create proper implementations for migrations that require external services
4. **Test Integration**: Ensure all apps work correctly with the shared database package

## Development

To work on the database package:

```bash
cd packages/database
pnpm build    # Build the package
pnpm dev      # Watch mode for development
```

The package is automatically built and available to other apps in the workspace.
