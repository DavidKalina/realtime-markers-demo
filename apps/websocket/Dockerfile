FROM oven/bun:1

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
COPY apps/websocket/package.json ./apps/websocket/

# Copy source code
COPY apps/websocket ./apps/websocket

# Install dependencies using pnpm for workspace support
RUN pnpm install --frozen-lockfile || pnpm install

# Set working directory to the websocket app
WORKDIR /app/apps/websocket

# Expose WebSocket port
EXPOSE 8081

# Run the app
CMD ["bun", "src/index.ts"]