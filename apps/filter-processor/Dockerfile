FROM oven/bun:1.1.1 as base

WORKDIR /app

# Install Node.js, npm, pnpm and system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    python3 \
    python3-pip \
    build-essential \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g pnpm@8.15.0 \
    && apt-get clean

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/filter-processor/package.json ./apps/filter-processor/

# Copy source code
COPY apps/filter-processor ./apps/filter-processor

# Install dependencies using pnpm for workspace support
RUN pnpm install --frozen-lockfile || pnpm install

# Build the application
RUN mkdir -p dist && bun build apps/filter-processor/src/index.ts --target bun --outfile dist/index.js

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