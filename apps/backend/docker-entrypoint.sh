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
exec "$@"