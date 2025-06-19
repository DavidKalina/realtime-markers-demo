# Install dependencies and build the app
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace configuration files first (these change less frequently)
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY package.json ./

# Copy the package.json for the specific app (this changes when dependencies change)
COPY apps/web-dashboard/package.json ./apps/web-dashboard/package.json

# Install dependencies (this layer will be cached unless package.json or lock files change)
RUN pnpm install --filter ./apps/web-dashboard

# Copy source code (this layer will be invalidated when source code changes)
COPY apps/web-dashboard/ ./apps/web-dashboard/

# Build the application (this layer will be invalidated when source code or dependencies change)
RUN pnpm --filter ./apps/web-dashboard build

# Production image
FROM node:20-alpine AS runner
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy the entire app with node_modules
COPY --from=builder /app/apps/web-dashboard ./apps/web-dashboard
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml ./

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

WORKDIR /app/apps/web-dashboard
CMD ["pnpm", "start"]