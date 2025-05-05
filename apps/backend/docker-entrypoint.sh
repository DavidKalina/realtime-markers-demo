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
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EOSQL

# Start the application
exec "$@" &
APP_PID=$!

# Wait for migrations to complete
echo "Waiting for migrations to complete..."
for i in {1..30}; do
  if PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'migrations')" | grep -q 't'; then
    echo "Migrations table exists"
    break
  fi
  
  if [ $i -eq 30 ]; then
    echo "Timeout waiting for migrations table to be created"
  fi
  
  echo "Waiting for migrations table to be created... (attempt $i/30)"
  sleep 2
done

echo "Starting index creation process..."

# Create only vector-specific indexes that aren't part of the migration
PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<EOSQL
    -- Vector indexes
    DROP INDEX IF EXISTS filters_embedding_idx;
    CREATE INDEX filters_embedding_idx 
    ON filters 
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

    DROP INDEX IF EXISTS events_embedding_idx;
    CREATE INDEX events_embedding_idx 
    ON events 
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
EOSQL

echo "Index creation completed successfully"

# Wait for the application to exit
wait $APP_PID