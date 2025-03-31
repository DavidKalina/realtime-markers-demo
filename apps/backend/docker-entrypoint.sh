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

# Create extensions first, before any tables are created
PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<EOSQL
    -- Enable required extensions
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS vector;
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
EOSQL

# Now we'll start the Bun application but add a wait loop to check for table existence
echo "Starting Bun application"
exec "$@" &
APP_PID=$!

# Wait for all relevant tables to be created
echo "Waiting for all tables to be created by TypeORM..."
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

# Add before index creation
echo "Starting index creation process..."

# Create non-vector indexes only if the events table exists
if PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'events')" | grep -q 't'; then
  echo "Creating additional indexes on events table"
  
  PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<EOSQL
      -- Existing indexes
      CREATE INDEX IF NOT EXISTS events_location_idx 
      ON events 
      USING GIST (location);

      CREATE INDEX IF NOT EXISTS events_title_trgm_idx 
      ON events 
      USING gin (title gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS events_description_trgm_idx 
      ON events 
      USING gin (description gin_trgm_ops);

      -- New indexes for events
      CREATE INDEX IF NOT EXISTS events_creator_id_idx
      ON events(creator_id);

      CREATE INDEX IF NOT EXISTS events_status_idx
      ON events(status);

      -- New compound index for location + date
      CREATE INDEX IF NOT EXISTS events_location_date_idx
      ON events(event_date)
      INCLUDE (location);

      -- New indexes for user_event_saves
      CREATE INDEX IF NOT EXISTS user_event_saves_saved_at_idx
      ON user_event_saves(saved_at);

      CREATE INDEX IF NOT EXISTS user_event_saves_user_date_idx
      ON user_event_saves(user_id, saved_at);

      -- New indexes for user_event_discoveries
      CREATE INDEX IF NOT EXISTS user_event_discoveries_discovered_at_idx
      ON user_event_discoveries(discovered_at);

      CREATE INDEX IF NOT EXISTS user_event_discoveries_user_date_idx
      ON user_event_discoveries(user_id, discovered_at);

      -- New indexes for filters
      CREATE INDEX IF NOT EXISTS filters_user_active_idx
      ON filters(user_id, is_active);
EOSQL

  # Check if the embedding column exists and is of type vector
  COLUMN_TYPE=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SELECT data_type FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'embedding';")

  # Trim whitespace from column type
  COLUMN_TYPE=$(echo "$COLUMN_TYPE" | xargs)

  echo "Column type for embedding: $COLUMN_TYPE"

  # Only create the vector index if the column type is 'vector'
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
else
  echo "Events table does not exist, skipping index creation"
fi

# Add after index creation
echo "Index creation completed successfully"

# Wait for the application to exit
wait $APP_PID