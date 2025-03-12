# notification-worker.Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Build TypeScript
RUN npm run build

# Set environment variable to indicate this is the notification worker
ENV SERVICE_TYPE=notification-worker

# Run the notification worker
CMD ["node", "dist/notification-worker.js"]