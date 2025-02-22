FROM oven/bun:1.0.35

WORKDIR /app

# Copy workspace and package files first
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json ./apps/backend/package.json

# Install dependencies from workspace root
RUN bun install

# Copy backend source AFTER installing dependencies
COPY apps/backend ./apps/backend

# Remove the prisma generate step from here
# RUN cd apps/backend && bunx prisma generate

# Expose ports
EXPOSE 3000 8080

# Start the application - use full path to index.ts
CMD ["bun", "run", "apps/backend/index.ts"]