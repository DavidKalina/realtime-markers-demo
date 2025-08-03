FROM oven/bun:1.0.35

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
    && apt-get install -y postgresql-client \
    && apt-get clean

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/database/package.json ./packages/database/

# Copy source code
COPY apps/backend ./apps/backend
COPY packages/database ./packages/database

# Install dependencies using pnpm for workspace support
RUN pnpm install --frozen-lockfile || pnpm install

# Build the database package
RUN cd packages/database && pnpm run build

# Verify that key dependencies are installed
RUN ls -la /app/apps/backend/node_modules/ | grep -E "(hono|ioredis)" || echo "Key dependencies not found"

# Create an entrypoint script
COPY apps/backend/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose ports
EXPOSE 3000 8080

# Use the entrypoint script
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["bun", "run", "/app/apps/backend/index.ts"]