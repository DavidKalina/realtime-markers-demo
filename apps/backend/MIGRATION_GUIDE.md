# Database Migration Guide

## Overview

This guide covers the database migration system, foreign key handling, and best practices for maintaining a clean migration history.

## Foreign Key Management

### The Problem We Solved

Previously, migrations were failing due to foreign key constraint conflicts. The issue was that the comprehensive foreign key migration (`AddAllUserForeignKeys1710000000014`) was trying to add constraints that already existed in table creation migrations.

### Current Migration Structure

```
✅ CategoryTable1710000000000
✅ EventTable1710000000001 (no user FK - added in comprehensive)
✅ EventShareTable1710000000002 (no user FK - added in comprehensive)
✅ FilterTable1710000000003 (no user FK - added in comprehensive)
✅ NotificationTable1710000000004 (no user FK - added in comprehensive)
✅ QueryAnalyticsTable1710000000005
✅ UserTable1710000000006
✅ UserEventDiscoveryTable1710000000007 (has user FK)
✅ UserEventRsvpTable1710000000008 (has user FK)
✅ UserEventSaveTable1710000000009 (has user FK)
✅ UserEventViewTable1710000000010 (has user FK)
✅ FriendshipTable1710000000011 (has user FK)
✅ SeedUsers1710000000012
✅ AddAllUserForeignKeys1710000000014 (only missing FKs)
```

### Foreign Key Rules

#### ✅ Tables with Foreign Keys in Creation Migration

These tables already have their foreign keys defined and should NOT be added to the comprehensive migration:

- `user_event_discoveries` - FK defined in `UserEventDiscoveryTable1710000000007`
- `user_event_rsvps` - FK defined in `UserEventRsvpTable1710000000008`
- `user_event_saves` - FK defined in `UserEventSaveTable1710000000009`
- `user_event_views` - FK defined in `UserEventViewTable1710000000010`
- `friendships` - FK defined in `FriendshipTable1710000000011`

#### ✅ Tables with Foreign Keys in Comprehensive Migration

These tables were created without foreign keys and have them added in `AddAllUserForeignKeys1710000000014`:

- `events.creator_id` → `users.id`
- `event_shares.shared_with_id` → `users.id`
- `event_shares.shared_by_id` → `users.id`
- `filters.user_id` → `users.id`
- `notifications.userId` → `users.id`

## Creating New Tables with Foreign Keys

### Process

1. **Generate Migration**

   ```bash
   bun run typeorm migration:generate -- -n CreateNewTableName
   ```

2. **Edit Migration File**

   ```typescript
   // Example: apps/backend/migrations/CreateUserPreferencesTable1710000000015.ts
   import { Table, TableForeignKey } from "typeorm";
   import type { MigrationInterface, QueryRunner } from "typeorm";

   export class CreateUserPreferencesTable1710000000015
     implements MigrationInterface
   {
     public async up(queryRunner: QueryRunner): Promise<void> {
       await queryRunner.createTable(
         new Table({
           name: "user_preferences",
           columns: [
             {
               name: "id",
               type: "uuid",
               isPrimary: true,
               isGenerated: true,
               generationStrategy: "uuid",
               default: "uuid_generate_v4()",
             },
             { name: "user_id", type: "uuid" }, // Foreign key column
             { name: "preference_key", type: "varchar" },
             { name: "preference_value", type: "jsonb" },
             {
               name: "created_at",
               type: "timestamptz",
               default: "CURRENT_TIMESTAMP",
             },
           ],
           foreignKeys: [
             // ✅ INCLUDE THE FOREIGN KEY HERE
             new TableForeignKey({
               columnNames: ["user_id"],
               referencedTableName: "users",
               referencedColumnNames: ["id"],
               onDelete: "CASCADE",
             }),
           ],
         }),
       );
     }

     public async down(queryRunner: QueryRunner): Promise<void> {
       await queryRunner.dropTable("user_preferences");
     }
   }
   ```

### Key Rules

#### ✅ **DO THIS** (Include FK in table creation):

```typescript
// In your table creation migration
foreignKeys: [
  new TableForeignKey({
    columnNames: ["user_id"],
    referencedTableName: "users",
    referencedColumnNames: ["id"],
    onDelete: "CASCADE",
  }),
];
```

#### ❌ **DON'T DO THIS** (Don't add to comprehensive migration):

```typescript
// DON'T add to AddAllUserForeignKeys1710000000014.ts
// The comprehensive migration is only for existing tables that were missing FKs
```

### Migration Order Requirements

- **Timestamp**: Ensure your migration timestamp is **after** the `users` table migration (`1710000000006`)
- **Dependencies**: If your table references multiple tables, ensure all referenced tables exist first

## Database Setup and Testing

### Initial Setup

```bash
# Start the full stack
docker-compose up -d

# The database will initialize successfully without foreign key errors
```

### Testing Migrations

```bash
# Test with fresh database
docker-compose down
docker-compose up -d

# Check database setup
bun run check-database-setup
```

### Troubleshooting

If you encounter foreign key errors:

1. **Check if FK already exists**: Look in the table creation migration
2. **Remove duplicates**: Remove duplicate foreign key definitions from comprehensive migration
3. **Use database checker**: `bun run check-database-setup`

## Common Patterns

### UUID Primary Key

```typescript
{
  name: "id",
  type: "uuid",
  isPrimary: true,
  isGenerated: true,
  generationStrategy: "uuid",
  default: "uuid_generate_v4()",
}
```

### Timestamps

```typescript
{
  name: "created_at",
  type: "timestamptz",
  default: "CURRENT_TIMESTAMP",
},
{
  name: "updated_at",
  type: "timestamptz",
  default: "CURRENT_TIMESTAMP",
}
```

### Foreign Key to Users

```typescript
new TableForeignKey({
  columnNames: ["user_id"],
  referencedTableName: "users",
  referencedColumnNames: ["id"],
  onDelete: "CASCADE", // or "SET NULL" depending on requirements
});
```

### Unique Constraints

```typescript
uniques: [
  {
    columnNames: ["user_id", "some_other_column"],
    name: "UQ_tableName_userId_otherColumn",
  },
];
```

### Indexes

```typescript
indices: [
  { columnNames: ["user_id"] },
  {
    columnNames: ["user_id", "created_at"],
    name: "IDX_tableName_userId_createdAt",
  },
];
```

## Migration Commands

### Generate Migration

```bash
bun run typeorm migration:generate -- -n MigrationName
```

### Run Migrations

```bash
bun run typeorm migration:run
```

### Revert Migration

```bash
bun run typeorm migration:revert
```

### Show Migration Status

```bash
bun run typeorm migration:show
```

## Best Practices

1. **Always include foreign keys in table creation migrations**
2. **Use descriptive migration names**
3. **Test migrations with fresh databases**
4. **Keep migrations atomic (one logical change per migration)**
5. **Include proper down() methods for rollback**
6. **Use consistent naming conventions**
7. **Document complex migrations with comments**

## Files to Reference

- `data-source.ts` - Database configuration and migration list
- `migrations/AddAllUserForeignKeys1710000000014.ts` - Comprehensive foreign key migration
- `scripts/check-database-setup.ts` - Database health checker
- `DATABASE_SETUP.md` - Database setup documentation
