#!/bin/bash
set -e

echo "🚀 Starting deployment process..."

# Create backup directory if it doesn't exist
BACKUP_DIR="/backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"

# Create database backup
echo "💾 Creating database backup..."
PGPASSWORD=$POSTGRES_PASSWORD pg_dump -h postgres -U "${POSTGRES_USER:-postgres}" "${POSTGRES_DB:-markersdb}" > "$BACKUP_FILE"

# Run migrations
echo "🔄 Running database migrations..."
if ! npm run migration:run; then
    echo "❌ Migration failed! Attempting rollback..."
    # Restore from backup
    PGPASSWORD=$POSTGRES_PASSWORD psql -h postgres -U "${POSTGRES_USER:-postgres}" "${POSTGRES_DB:-markersdb}" < "$BACKUP_FILE"
    echo "✅ Rollback completed from backup: $BACKUP_FILE"
    exit 1
fi

echo "✅ Migration completed successfully!"
echo "💾 Backup file: $BACKUP_FILE" 