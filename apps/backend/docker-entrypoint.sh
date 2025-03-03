#!/bin/bash
set -e

# Wait for PostgreSQL service to be available
until PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "postgres" -c '\q'; do
  echo "PostgreSQL service unavailable - sleeping"
  sleep 1
done

echo "PostgreSQL service is up - checking if database exists"

# Create the database if it doesn't exist
PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "postgres" <<-EOSQL
    SELECT 'CREATE DATABASE $POSTGRES_DB' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$POSTGRES_DB')\gexec
EOSQL

echo "Ensuring database $POSTGRES_DB exists - now connecting"

# Wait for the database to be accessible
until PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\q'; do
  echo "Database $POSTGRES_DB not yet accessible - sleeping"
  sleep 1
done

echo "PostgreSQL database $POSTGRES_DB is up - checking extensions"

# Create extensions and indexes safely
PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<-EOSQL
    -- Enable required extensions
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS vector;
    CREATE EXTENSION IF NOT EXISTS pg_trgm;

    -- Drop existing indexes that might cause issues
    DROP INDEX IF EXISTS events_embedding_idx;
EOSQL

# Check if the table exists and column type
COLUMN_TYPE=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SELECT data_type FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'embedding';")

# Trim whitespace from column type
COLUMN_TYPE=$(echo "$COLUMN_TYPE" | xargs)

echo "Column type for embedding: $COLUMN_TYPE"

# Create non-vector indexes
PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<-EOSQL
    -- Only create indexes if they don't exist
    CREATE INDEX IF NOT EXISTS events_location_idx 
    ON events 
    USING GIST (location);

    CREATE INDEX IF NOT EXISTS events_title_trgm_idx 
    ON events 
    USING gin (title gin_trgm_ops);

    CREATE INDEX IF NOT EXISTS events_description_trgm_idx 
    ON events 
    USING gin (description gin_trgm_ops);

    CREATE INDEX IF NOT EXISTS events_date_idx 
    ON events (event_date);
EOSQL

# Only create the vector index if the column type is 'vector'
if [ "$COLUMN_TYPE" = "vector" ]; then
  echo "Creating vector index for embedding column"
  PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
    CREATE INDEX events_embedding_idx 
    ON events 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
  "
elif [ -n "$COLUMN_TYPE" ]; then
  echo "WARNING: embedding column exists but is not of type vector (found: $COLUMN_TYPE). Vector index NOT created."
else
  echo "INFO: embedding column not found. Vector index NOT created."
fi

# Execute the main command
echo "Starting Node.js application"
exec "$@"