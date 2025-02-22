FROM node:20-alpine

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web-vanilla/package.json ./apps/web-vanilla/package.json

# Install pnpm
RUN npm install -g pnpm

# Copy frontend source
COPY apps/web-vanilla ./apps/web-vanilla

# Install dependencies using pnpm
RUN pnpm install

# Set working directory to frontend
WORKDIR /app/apps/web-vanilla

# Expose port
EXPOSE 5173

# Start the application
CMD ["pnpm", "run", "dev"]