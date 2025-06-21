# Handler Utilities Examples

This document shows how to use the new handler utilities to reduce code duplication and improve consistency across handlers.

## Before vs After Examples

### 1. Basic Authentication and Parameter Validation

**Before:**

```typescript
export const someHandler: EventHandler = async (c) => {
  try {
    const user = c.get("user");
    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const eventId = c.req.param("id");
    if (!eventId) {
      return c.json({ error: "Missing event ID" }, 400);
    }

    const eventService = c.get("eventService");
    const event = await eventService.getEventById(eventId);
    if (!event) {
      return c.json({ error: "Event not found" }, 404);
    }

    // ... business logic ...
    return c.json(result);
  } catch (error) {
    console.error("Error in handler:", error);
    return c.json(
      {
        error: "Failed to process request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};
```

**After:**

```typescript
export const someHandler: EventHandler = withErrorHandling(async (c) => {
  const user = requireAuth(c);
  const eventId = requireParam(c, "id");
  const event = await requireEvent(c, eventId);

  // ... business logic ...
  return c.json(result);
});
```

### 2. Query Parameter Validation

**Before:**

```typescript
export const searchHandler: EventHandler = async (c) => {
  try {
    const query = c.req.query("q");
    if (!query) {
      return c.json({ error: "Missing required query parameter: q" }, 400);
    }

    // ... business logic ...
  } catch (error) {
    // ... error handling ...
  }
};
```

**After:**

```typescript
export const searchHandler: EventHandler = withErrorHandling(async (c) => {
  const query = requireQueryParam(c, "q");

  // ... business logic ...
});
```

### 3. Body Field Validation

**Before:**

```typescript
export const createHandler: EventHandler = async (c) => {
  try {
    const body = await c.req.json();
    if (!body.title) {
      return c.json({ error: "Missing required field: title" }, 400);
    }

    // ... business logic ...
  } catch (error) {
    // ... error handling ...
  }
};
```

**After:**

```typescript
export const createHandler: EventHandler = withErrorHandling(async (c) => {
  const title = await requireBodyField<string>(c, "title");

  // ... business logic ...
});
```

### 4. Enum Validation

**Before:**

```typescript
export const updateStatusHandler: EventHandler = async (c) => {
  try {
    const { status } = await c.req.json();
    if (!status || !["ACTIVE", "INACTIVE", "PENDING"].includes(status)) {
      return c.json({ error: "Invalid status" }, 400);
    }

    // ... business logic ...
  } catch (error) {
    // ... error handling ...
  }
};
```

**After:**

```typescript
export const updateStatusHandler: EventHandler = withErrorHandling(
  async (c) => {
    const { status } = await c.req.json();
    validateEnum(status, ["ACTIVE", "INACTIVE", "PENDING"], "status");

    // ... business logic ...
  },
);
```

## Available Utilities

### Authentication

- `requireAuth(c)` - Ensures user is authenticated, throws `AuthenticationError` if not
- `requireAuthHandler(handler)` - Wrapper that adds authentication to any handler

### Parameter Validation

- `requireParam(c, paramName)` - Validates required URL parameters
- `requireQueryParam(c, paramName)` - Validates required query parameters
- `requireBodyField<T>(c, fieldName)` - Validates required body fields
- `validateArray(value, fieldName)` - Validates that a value is an array
- `validateEnum(value, allowedValues, fieldName)` - Validates enum values

### Error Handling

- `withErrorHandling(handler)` - Wrapper that adds consistent error handling
- `handleError(c, error)` - Centralized error handling logic

### Service Getters

- `getEventService(c)` - Gets event service from context
- `getAuthService(c)` - Gets auth service from context
- `getNotificationService(c)` - Gets notification service from context
- `getJobQueue(c)` - Gets job queue from context
- `getRedisClient(c)` - Gets Redis client from context

### Response Helpers

- `successResponse(c, data)` - Standardized success response

## Benefits

1. **Reduced Code Duplication** - Common patterns are extracted into reusable functions
2. **Consistent Error Handling** - All handlers use the same error handling logic
3. **Type Safety** - Better TypeScript support with proper error types
4. **Easier Testing** - Utilities can be tested independently
5. **Better Maintainability** - Changes to validation logic only need to be made in one place

## Migration Strategy

1. Start with simple handlers that only need basic validation
2. Gradually migrate more complex handlers
3. Update tests to use the new utilities
4. Remove old validation code once migration is complete
