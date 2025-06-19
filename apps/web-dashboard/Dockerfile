# Install dependencies and build the app
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY package.json ./
COPY apps/web-dashboard/package.json ./apps/web-dashboard/package.json
COPY apps/web-dashboard/ ./apps/web-dashboard/

# Install dependencies and build
RUN pnpm install --filter ./apps/web-dashboard
RUN pnpm --filter ./apps/web-dashboard build

# Production image with build process
FROM node:20-alpine AS runner
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY package.json ./
COPY apps/web-dashboard/package.json ./apps/web-dashboard/package.json
COPY apps/web-dashboard/ ./apps/web-dashboard/

# Install dependencies and build the app
RUN pnpm install --filter ./apps/web-dashboard
RUN pnpm --filter ./apps/web-dashboard build

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