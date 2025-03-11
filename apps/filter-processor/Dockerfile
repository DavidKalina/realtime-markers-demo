FROM oven/bun:1.1.1 as base

WORKDIR /app

# Copy only this package's package.json
COPY apps/filter-processor/package.json ./package.json

# Install dependencies directly (without workspace)
RUN bun install

# Copy source files
COPY apps/filter-processor/src ./src
COPY apps/filter-processor/tsconfig.json ./tsconfig.json

# Build the application
RUN mkdir -p dist && bun build src/index.ts --target bun --outfile dist/index.js

# Use a smaller image for production
FROM oven/bun:1.1.1

WORKDIR /app

# Install wget for health checks
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

# Copy built app and dependencies
COPY --from=base /app/dist /app/dist
COPY --from=base /app/node_modules /app/node_modules

# Expose the health check port
EXPOSE 8082

# Start the application
CMD ["bun", "run", "/app/dist/index.js"]