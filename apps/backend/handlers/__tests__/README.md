# Testing Strategy for Worker and Job Handlers

## Overview

This directory contains comprehensive tests for the worker.ts and job handlers in the backend application. The testing approach focuses on:

1. **Unit Testing**: Testing individual components in isolation
2. **Integration Testing**: Testing how components work together
3. **Error Handling**: Ensuring graceful failure scenarios
4. **Mocking**: Using mocks to isolate dependencies

## Test Structure

```
__tests__/
├── worker.test.ts                    # Tests for worker.ts functionality
├── BaseJobHandler.test.ts            # Tests for base job handler class
├── JobHandlerRegistry.test.ts        # Tests for job handler registry
├── CleanupEventsHandler.test.ts      # Tests for cleanup events handler
├── test-utils.ts                     # Shared test utilities and mocks
└── README.md                         # This file
```

## Running Tests

```bash
# Run all tests in this directory
bun test

# Run specific test file
bun test worker.test.ts

# Run tests in watch mode
bun test --watch

# Run tests with coverage
bun test --coverage
```

## Test Utilities

The `test-utils.ts` file provides reusable utilities for testing:

### Mock Factories

```typescript
import {
  createMockJobQueue,
  createMockRedisService,
  createMockEventService,
  createMockEventProcessingService,
  createMockPlanService,
  createMockStorageService,
  createMockJobHandlerContext,
} from "./test-utils";

// Create mocks for testing
const mockJobQueue = createMockJobQueue();
const mockRedisService = createMockRedisService();
const context = createMockJobHandlerContext(mockJobQueue, mockRedisService);
```

### Job Data Factories

```typescript
import {
  createTestJobData,
  createProcessFlyerJobData,
  createProcessPrivateEventJobData,
  createCleanupEventsJobData,
} from "./test-utils";

// Create test job data
const flyerJob = createProcessFlyerJobData({
  data: { imageUrl: "https://example.com/test.jpg" },
});

const cleanupJob = createCleanupEventsJobData({
  data: { batchSize: 50 },
});
```

### Helper Functions

```typescript
import { wait, verifyJobProgress } from "./test-utils";

// Wait for async operations
await wait(100);

// Verify job progress updates
verifyJobProgress(mockUpdateJobStatus, "job-123", [
  { status: "processing", progress: 5 },
  { progress: 50, progressStep: "Processing" },
  { status: "completed", progress: 100 },
]);
```

## Testing Patterns

### 1. Worker Testing

The worker tests focus on:

- **Initialization**: Ensuring all services are properly initialized
- **Job Processing**: Testing job queue processing logic
- **Error Handling**: Testing graceful failure scenarios
- **Concurrency**: Testing maximum concurrent jobs limit
- **Timeout Handling**: Testing job timeout mechanisms

### 2. BaseJobHandler Testing

Tests for the base class include:

- **Job Type Validation**: Ensuring handlers can identify their job types
- **Protected Methods**: Testing startJob, updateJobProgress, failJob, completeJob
- **Step Count Logic**: Testing the step counting mechanism
- **Interface Compliance**: Ensuring handlers implement the required interface

### 3. JobHandlerRegistry Testing

Registry tests cover:

- **Handler Registration**: Ensuring all handlers are registered
- **Handler Retrieval**: Testing handler lookup by job type
- **Context Management**: Testing context provision to handlers
- **Registry Integrity**: Ensuring no duplicate handlers

### 4. Individual Handler Testing

Each job handler is tested for:

- **Job Type Validation**: Correct job type identification
- **Processing Flow**: Complete job processing workflow
- **Error Handling**: Graceful error handling and reporting
- **Service Integration**: Proper interaction with dependencies
- **Progress Updates**: Correct progress reporting

## Mock Strategy

### Service Mocks

All external services are mocked to:

- **Isolate Units**: Test components without external dependencies
- **Control Behavior**: Simulate success, failure, and edge cases
- **Verify Interactions**: Ensure correct service method calls
- **Speed Up Tests**: Avoid slow external service calls

### Mock Verification

Tests verify that:

- **Correct Methods Are Called**: Services are called with expected parameters
- **Correct Number of Calls**: Methods are called the expected number of times
- **Correct Order**: Methods are called in the expected sequence
- **Error Scenarios**: Services handle errors appropriately

## Best Practices

### 1. Test Organization

- **Arrange-Act-Assert**: Structure tests clearly
- **Descriptive Names**: Use clear, descriptive test names
- **Single Responsibility**: Each test should test one thing
- **Independent Tests**: Tests should not depend on each other

### 2. Mock Management

- **Fresh Mocks**: Create fresh mocks for each test
- **Reset Mocks**: Clear mock state between tests
- **Verify Calls**: Always verify that mocks are called correctly
- **Realistic Data**: Use realistic test data

### 3. Error Testing

- **Happy Path**: Test successful scenarios
- **Error Paths**: Test error scenarios
- **Edge Cases**: Test boundary conditions
- **Recovery**: Test error recovery mechanisms

### 4. Async Testing

- **Proper Waiting**: Use appropriate waiting mechanisms
- **Promise Handling**: Handle promises correctly
- **Timeout Testing**: Test timeout scenarios
- **Concurrency**: Test concurrent operations

## Adding New Tests

### 1. For New Job Handlers

1. Create a new test file: `NewHandler.test.ts`
2. Import the handler and test utilities
3. Create mocks for dependencies
4. Test job type validation
5. Test complete processing flow
6. Test error scenarios
7. Test service interactions

### 2. For New Worker Features

1. Add tests to `worker.test.ts`
2. Test initialization with new services
3. Test new job processing logic
4. Test new error handling
5. Test new configuration options

### 3. For New Utilities

1. Add utility functions to `test-utils.ts`
2. Document the utility with JSDoc comments
3. Create tests for the utility if needed
4. Update this README with usage examples

## Common Issues and Solutions

### 1. Mock Not Called

**Problem**: Mock function not being called as expected
**Solution**:

- Check if the mock is properly injected
- Verify the method is actually being called
- Check for conditional logic that might skip the call

### 2. Async Test Failures

**Problem**: Tests failing due to timing issues
**Solution**:

- Use `wait()` utility for async operations
- Use `createDelayedMock()` for controlled timing
- Ensure proper promise handling

### 3. Type Errors

**Problem**: TypeScript errors in tests
**Solution**:

- Use proper type annotations
- Use `as unknown as Type` for complex mocks
- Import types from the correct modules

### 4. Test Isolation

**Problem**: Tests affecting each other
**Solution**:

- Create fresh mocks in `beforeEach`
- Clear mock state between tests
- Use unique test data for each test

## Coverage Goals

- **Line Coverage**: > 90%
- **Branch Coverage**: > 85%
- **Function Coverage**: > 95%

## Continuous Integration

Tests are automatically run:

- On every pull request
- Before merging to main
- In the CI/CD pipeline

## Resources

- [Bun Test Documentation](https://bun.sh/docs/cli/test)
- [Testing Best Practices](https://jestjs.io/docs/best-practices)
- [Mocking Strategies](https://jestjs.io/docs/mock-functions)
