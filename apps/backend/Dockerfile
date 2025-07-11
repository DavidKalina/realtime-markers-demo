FROM oven/bun:1.0.35

WORKDIR /app

# Install PostgreSQL client, Python, and build tools for native dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    curl \
    python3 \
    python3-pip \
    build-essential \
    && apt-get clean

# Copy workspace and package files first
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json ./apps/backend/package.json

# Install dependencies
RUN bun install
RUN cd /app/apps/backend && bun add -d typeorm@latest @types/node ts-node typescript

# Copy backend source AFTER installing dependencies
COPY apps/backend ./apps/backend

# Create an entrypoint script
COPY apps/backend/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose ports
EXPOSE 3000 8080

# Use the entrypoint script
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["bun", "run", "/app/apps/backend/index.ts"]