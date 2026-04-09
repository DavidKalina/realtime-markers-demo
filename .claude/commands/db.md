---
description: Database operations — wipe users, reset data, run queries, inspect tables
argument-hint: <wipe users | wipe all | query "SQL" | tables | inspect <table>>
allowed-tools: [Bash, Read, Grep]
---

# Database Operations

Run database operations against the Dockerized Postgres instance.

## Arguments

The user invoked this with: $ARGUMENTS

## Connection Details

- Container: `realtime-markers-demo-postgres-1`
- User: `postgres`
- Password: `devpassword`
- Database: `markersdb`
- Redis container: `realtime-markers-demo-redis-1`
- Redis password: `devredispassword`

## PSQL shorthand

All queries run via:

```bash
docker exec realtime-markers-demo-postgres-1 psql -U postgres -d markersdb -c "SQL_HERE"
```

## Operations

Parse the user's request and run the appropriate operation:

### Wipe user data (fresh simulation)

When the user says "wipe users", "reset users", "fresh simulation", or similar — delete all user-generated data while keeping the schema intact:

```sql
TRUNCATE objective_checkins, objectives, sidequests, pathways, coverage_clusters, coverage_snapshots, user_badges, user_push_tokens CASCADE;
UPDATE users SET
  home_latitude = NULL,
  home_longitude = NULL,
  comfort_radius_miles = 1.5,
  total_xp = 0,
  current_tier = NULL,
  current_streak = 0,
  longest_streak = 0,
  discovery_count = 0,
  scan_count = 0,
  save_count = 0,
  view_count = 0,
  active_sidequest_id = NULL,
  comfort_profile = NULL,
  onboarding_profile = NULL,
  pace_preference = NULL,
  fear_ladder = NULL,
  behavioral_profile = NULL,
  expectancy_calibration = NULL;
```

Also flush non-cache Redis keys (preserve geocoding/places/weather caches to avoid unnecessary Google API charges):

```bash
# Delete app-state keys (jobs, user stats, etc.) but preserve expensive API caches
docker exec realtime-markers-demo-redis-1 redis-cli -a devredispassword --no-auth-warning KEYS '*' | grep -v -E '^(geocache:|places-category:|reverse-geocode:|entry-point:|weather:)' | xargs -r docker exec -i realtime-markers-demo-redis-1 redis-cli -a devredispassword --no-auth-warning DEL
```

### Wipe all (nuclear reset)

When the user says "wipe all", "nuke", "start from scratch":

```sql
TRUNCATE objective_checkins, objectives, sidequests, pathways, coverage_clusters, coverage_snapshots, user_badges, user_push_tokens, users, llm_usage_logs CASCADE;
```

Plus flush Redis. Warn the user that seeded accounts will be deleted and they'll need to re-seed.

### List tables

When the user says "tables", "show tables", "list tables":

```sql
SELECT table_name, pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

### Inspect a table

When the user says "inspect <table>", "describe <table>", "show <table>":

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = '<table>'
ORDER BY ordinal_position;
```

And show row count:

```sql
SELECT COUNT(*) FROM <table>;
```

### Run a query

When the user provides raw SQL or asks to query something specific, run it directly. Use `\x` for wide results:

```bash
docker exec realtime-markers-demo-postgres-1 psql -U postgres -d markersdb -x -c "SQL_HERE"
```

### Check quest history for a user

When the user asks about a user's quest history:

```sql
SELECT s.title, o.venue_name, o.venue_category, s.rating, o.completed_activity,
       LEFT(o.journal_entry, 80) as journal_snippet, o.social_context, s.completed_at
FROM sidequests s
JOIN objectives o ON o.sidequest_id = s.id
WHERE s.user_id = (SELECT id FROM users WHERE email = '<email>')
  AND s.deleted_at IS NULL
ORDER BY s.created_at DESC
LIMIT 20;
```

Default email is `user@example.com` unless specified.

## Rules

1. Always use `docker exec` — never connect directly to localhost:5432 (the containers use internal networking).
2. For destructive operations (TRUNCATE, DELETE, DROP), show what will be affected and confirm with the user before running.
3. After wipes, report what was cleared.
4. Always use `pnpm tsx` (not npx) if running any scripts.
