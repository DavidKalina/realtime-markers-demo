#!/bin/bash
set -e

# Wait for PostgreSQL service to be available
until PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "postgres" -c '\q'; do
  echo "PostgreSQL service unavailable - sleeping"
  sleep 1
done

echo "PostgreSQL service is up - checking if database exists"

# Create the database if it doesn't exist
PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "postgres" <<EOSQL
    SELECT 'CREATE DATABASE $POSTGRES_DB' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$POSTGRES_DB')\gexec
EOSQL

echo "Ensuring database $POSTGRES_DB exists - now connecting"

# Wait for the database to be accessible
until PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\q'; do
  echo "Database $POSTGRES_DB not yet accessible - sleeping"
  sleep 1
done

echo "PostgreSQL database $POSTGRES_DB is up - setting up extensions"

# Create extensions first
PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<EOSQL
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS vector;
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
EOSQL

# Start the application
exec "$@" &
APP_PID=$!

# Wait for tables to be created
echo "Waiting for tables to be created by TypeORM..."
tables=("events" "user_event_saves" "user_event_discoveries" "filters")
for table in "${tables[@]}"; do
  for i in {1..30}; do
    if PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$table')" | grep -q 't'; then
      echo "$table table exists"
      break
    fi
    
    if [ $i -eq 30 ]; then
      echo "Timeout waiting for $table table to be created"
    fi
    
    echo "Waiting for $table table to be created... (attempt $i/30)"
    sleep 2
  done
done

echo "Starting index creation process..."

# Create special indexes
PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<EOSQL
    -- Spatial index for PostGIS
    CREATE INDEX IF NOT EXISTS events_location_gist_idx 
    ON events USING GIST (location);

    -- Text search indexes
    CREATE INDEX IF NOT EXISTS events_title_trgm_idx 
    ON events USING gin (title gin_trgm_ops);

    CREATE INDEX IF NOT EXISTS events_description_trgm_idx 
    ON events USING gin (description gin_trgm_ops);
EOSQL

# Check for vector column and create index if appropriate
COLUMN_TYPE=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SELECT data_type FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'embedding';")
COLUMN_TYPE=$(echo "$COLUMN_TYPE" | xargs)

echo "Column type for embedding: $COLUMN_TYPE"

if [ "$COLUMN_TYPE" = "vector" ]; then
    echo "Creating vector index for embedding column"
    PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
        DROP INDEX IF EXISTS events_embedding_idx;
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

echo "Index creation completed successfully"

# Wait for the application to exit
wait $APP_PID