# User Seeding Documentation

This document explains how to seed the database with predefined user profiles for development and testing purposes.

## Overview

The system provides **three ways** to seed users, all using a shared seeding utility:

1. **Automatic development seeding** - Runs automatically when the database initializes in development mode
2. **Migration-based seeding** - Automatically runs when migrations are executed
3. **Standalone seeding script** - Can be run independently

## Architecture

The seeding functionality is centralized in `utils/userSeeder.ts` which contains:

- **`SEEDED_USERS`** - Array of user configurations (without passwords)
- **`SEEDED_PASSWORDS`** - Object mapping emails to plain text passwords
- **`seedUsers()`** - Shared function that handles the seeding logic

This eliminates code duplication and ensures consistency across all seeding methods.

## Seeded Users

The following three user profiles are created:

### 1. Regular User

- **Email**: `user@example.com`
- **Password**: `user123`
- **Role**: `USER`
- **Plan**: `FREE`
- **Username**: `regularuser`
- **Friend Code**: `USER001`

### 2. Moderator User

- **Email**: `moderator@example.com`
- **Password**: `moderator123`
- **Role**: `MODERATOR`
- **Plan**: `PRO`
- **Username**: `moderator`
- **Friend Code**: `MOD001`

### 3. Admin User

- **Email**: `admin@example.com`
- **Password**: `admin123`
- **Role**: `ADMIN`
- **Plan**: `PRO`
- **Username**: `admin`
- **Friend Code**: `ADMIN001`

## Usage

### Option 1: Automatic Development Seeding (Recommended)

The `data-source.ts` file now automatically seeds users when running in development mode. Simply start your application with:

```bash
# Set development environment
export NODE_ENV=development
# or
export NODE_ENV=dev

# Start your application
npm run dev
# or
bun run dev
```

The seeding will run automatically after the database connection is established.

### Option 2: Migration-based Seeding

The migration `SeedUsers1710000000012.ts` will automatically create these users when you run your database migrations:

```bash
# Run migrations (this will include user seeding)
npm run migration:run
# or
bun run migration:run
```

### Option 3: Standalone Seeding Script

**Note**: The standalone seeding script has been removed as seeding is now handled automatically through migrations and development mode initialization.

For manual seeding, you can use the migration system:

```bash
# Run migrations (this will include user seeding)
npm run migration:run
# or
bun run migration:run
```

## Environment Configuration

### Automatic Seeding Control

The automatic seeding in `data-source.ts` is controlled by the `NODE_ENV` environment variable:

- **Development Mode**: `NODE_ENV=development` or `NODE_ENV=dev` - Seeding runs automatically
- **Production Mode**: `NODE_ENV=production` - Seeding is skipped
- **Test Mode**: `NODE_ENV=test` - Seeding is skipped

### Disabling Automatic Seeding

To disable automatic seeding even in development mode, you can set:

```bash
export DISABLE_USER_SEEDING=true
```

Then modify the `data-source.ts` file to check for this variable:

```typescript
// In data-source.ts, modify the seeding condition:
if (
  (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev") &&
  process.env.DISABLE_USER_SEEDING !== "true"
) {
  console.log("Development mode detected. Running user seeding...");
  await seedUsers(AppDataSource);
}
```

## Features

- ✅ **Centralized**: Single source of truth for user data and seeding logic
- ✅ **Automatic**: Runs automatically in development mode
- ✅ **Idempotent**: Safe to run multiple times - won't create duplicate users
- ✅ **Password Security**: All passwords are properly hashed using bcrypt with salt rounds of 10
- ✅ **Verified Users**: All seeded users are marked as verified
- ✅ **Unique Constraints**: Uses unique friend codes and usernames
- ✅ **Role-based Access**: Each user has appropriate role and plan type
- ✅ **Environment Aware**: Only runs in development mode
- ✅ **Configurable**: Can be disabled via environment variables
- ✅ **DRY**: No code duplication across different seeding methods

## Rollback

### Migration Rollback

To remove seeded users via migration:

```bash
npm run migration:revert
# or
bun run migration:revert
```

### Manual Removal

To manually remove seeded users from the database:

```sql
DELETE FROM users
WHERE email IN (
  'user@example.com',
  'moderator@example.com',
  'admin@example.com'
);
```

## Development Notes

- The seeding logic is centralized in `utils/userSeeder.ts`
- All seeding methods use the same user data and password hashing logic
- The automatic seeding uses `ON CONFLICT (email) DO NOTHING` to prevent duplicate creation
- All users are created with verified status for immediate use
- Friend codes follow a simple pattern: `USER001`, `MOD001`, `ADMIN001`
- Automatic seeding only runs once per application startup in development mode

## Security Considerations

- These are development/testing credentials and should not be used in production
- Passwords are intentionally simple for development purposes
- In production, use strong, unique passwords and proper user registration flows
- Consider using environment variables for production user creation
- Automatic seeding is disabled in production environments

## Modifying Seeded Users

To modify the seeded users, edit the `SEEDED_USERS` array in `utils/userSeeder.ts`:

```typescript
export const SEEDED_USERS: Omit<SeededUser, "passwordHash">[] = [
  // Add or modify user configurations here
];
```

To change passwords, update the `SEEDED_PASSWORDS` object:

```typescript
export const SEEDED_PASSWORDS = {
  "user@example.com": "newpassword123",
  // ... other passwords
} as const;
```
