FROM oven/bun:1.0.35

WORKDIR /app

# Copy workspace and package files first
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json ./apps/backend/package.json

# Install all dependencies
RUN bun install
RUN cd /app/apps/backend && bun add -d typeorm@latest @types/node ts-node typescript
RUN cd /app/apps/backend && bun add hono@latest ioredis@latest

# Copy backend source AFTER installing dependencies
COPY apps/backend ./apps/backend

# Create a simple worker entrypoint script
RUN echo '#!/bin/bash\necho "Starting worker..."\nexec "$@"' > /usr/local/bin/worker-entrypoint.sh
RUN chmod +x /usr/local/bin/worker-entrypoint.sh

# Use the worker entrypoint script
ENTRYPOINT ["/usr/local/bin/worker-entrypoint.sh"]
CMD ["bun", "run", "/app/apps/backend/worker.ts"]