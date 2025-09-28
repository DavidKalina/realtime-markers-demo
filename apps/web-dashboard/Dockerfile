# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Set NODE_ENV to production for the build
ENV NODE_ENV=production

# Copy workspace configuration files first (these change less frequently)
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY package.json ./

# Copy all package.json files (including packages)
COPY packages/ ./packages/
COPY apps/web-dashboard/package.json ./apps/web-dashboard/package.json

# Install dependencies for all packages and the web-dashboard
RUN pnpm install --frozen-lockfile

# Build the packages first
RUN pnpm --filter @realtime-markers/database build
RUN pnpm --filter @realtime-markers/shared build

# Copy source code (this layer will be invalidated when source code changes)
COPY apps/web-dashboard/ ./apps/web-dashboard/

# Build the web-dashboard application
RUN pnpm --filter ./apps/web-dashboard build

# Production image
FROM node:20-alpine AS runner
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Set NODE_ENV to production
ENV NODE_ENV=production

# Copy the entire app with node_modules
COPY --from=builder /app/apps/web-dashboard ./apps/web-dashboard
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml ./

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3001

ENV PORT 3001
ENV HOSTNAME "0.0.0.0"

WORKDIR /app/apps/web-dashboard
CMD ["pnpm", "start"]