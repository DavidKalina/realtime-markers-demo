#!/bin/bash
set -e

# Wait for PostgreSQL
until PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\q'; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 1
done

echo "PostgreSQL is up - checking extensions"

# Create extensions
PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<-EOSQL
    -- Enable required extensions
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS vector;
    CREATE EXTENSION IF NOT EXISTS pg_trgm;

    -- Create vector similarity index (IVFFlat)
    CREATE INDEX IF NOT EXISTS events_embedding_idx 
    ON events 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

    -- Create spatial index for location queries
    CREATE INDEX IF NOT EXISTS events_location_idx 
    ON events 
    USING GIST (location);

    -- Create GiST indexes for text search on title and description
    CREATE INDEX IF NOT EXISTS events_title_trgm_idx 
    ON events 
    USING gin (title gin_trgm_ops);

    CREATE INDEX IF NOT EXISTS events_description_trgm_idx 
    ON events 
    USING gin (description gin_trgm_ops);

    -- Create B-tree index for event date
    CREATE INDEX IF NOT EXISTS events_date_idx 
    ON events (event_date);
EOSQL

# Just start the server - no seeding or migrations
exec "$@"