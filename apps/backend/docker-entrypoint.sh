#!/bin/bash
set -e

# Wait for PostgreSQL to be ready
until PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\q'; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 1
done

echo "PostgreSQL is up - checking extensions"

# Create extensions if they don't exist
PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c 'CREATE EXTENSION IF NOT EXISTS postgis;'
PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c 'CREATE EXTENSION IF NOT EXISTS vector;'
PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c 'CREATE EXTENSION IF NOT EXISTS pg_trgm;'

# Run migrations first
echo "Running migrations..."
if [ -d "/app/apps/backend/migrations" ]; then
  cd /app/apps/backend && bunx typeorm migration:run -d ./data-source.ts
else
  echo "No migrations directory found - skipping migrations"
fi

# Then run seeding by executing the seeder file directly
echo "Running database seeding..."
cd /app/apps/backend && bun run seeds/runSeeder.ts

# Finally, start the main server process
exec "$@"