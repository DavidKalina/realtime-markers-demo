FROM oven/bun:1.0.35

WORKDIR /app

# Copy workspace and package files first
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/backend/package.json ./apps/backend/package.json

# Copy shared package source
COPY packages/shared ./packages/shared

# Copy backend source
COPY apps/backend ./apps/backend

# Install dependencies from workspace root
RUN bun install

# Expose ports
EXPOSE 3000 8080

# Start the application - use full path to index.ts
CMD ["bun", "run", "apps/backend/index.ts"]