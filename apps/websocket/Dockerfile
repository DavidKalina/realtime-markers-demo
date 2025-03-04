FROM oven/bun:1

WORKDIR /app

# Copy package files first
COPY package.json pnpm-workspace.yaml ./
COPY apps/websocket/package.json ./apps/websocket/

# Install dependencies
RUN apt-get update && apt-get install -y curl && apt-get clean
RUN cd apps/websocket && bun install

# Copy only the necessary files, excluding node_modules
COPY apps/websocket/*.ts ./apps/websocket/
COPY apps/websocket/tsconfig.json ./apps/websocket/

# Set working directory to the websocket app
WORKDIR /app/apps/websocket

# Expose WebSocket port
EXPOSE 8081

# Run the app
CMD ["bun", "index.ts"]