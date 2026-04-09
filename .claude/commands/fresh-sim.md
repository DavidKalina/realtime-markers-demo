---
description: Reset + simulation — restarts Docker (preserving caches), wipes user data, runs a simulation, and summarizes results
argument-hint: <goal or persona> [--blocker <text>] [--quests <n>] [--email <email>]
allowed-tools: [Bash, Read, Grep]
---

# Fresh Simulation (Full Reset)

Tears down the entire environment, starts it via `pnpm dev:local:no-ngrok`, wipes the database, runs a live simulation, and provides a summary.

## Arguments

The user invoked this with: $ARGUMENTS

## Steps

Follow these steps **exactly and sequentially**. Do NOT skip steps. Report progress to the user at each stage.

### Step 1: Kill any existing dev environment and wipe user data

Kill any running dev-local.sh process, restart containers (preserving volumes so caches survive), and wipe user data:

```bash
pkill -f "dev-local.sh" 2>/dev/null || true
pkill -f "expo start" 2>/dev/null || true
docker compose down
```

Then wipe user data using the `/db wipe users` skill. This clears user-generated data from Postgres and flushes non-cache Redis keys while preserving geocoding/places/weather caches.

Report: "Environment torn down, user data wiped."

### Step 2: Start the dev environment

Run `pnpm dev:local:no-ngrok` **in the background** since it launches Expo in the foreground at the end (which we don't need for simulation):

```bash
pnpm run dev:local:no-ngrok 2>&1 &
```

Run this with `run_in_background: true`. This handles:

- Docker compose up with HTTP overlay (ports exposed directly)
- Health checks for all services
- Backend migrations
- Expo startup (runs but we don't need it)

### Step 3: Wait for backend health

Poll the health endpoint until it responds (max 180 seconds, check every 5 seconds):

```bash
for i in $(seq 1 36); do
  if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "Backend is healthy"
    exit 0
  fi
  echo "Waiting for backend... (attempt $i/36)"
  sleep 5
done
echo "Backend failed to start"
exit 1
```

Use a 180-second timeout. If this fails, show `docker compose logs backend --tail 30` and stop.

Report: "Backend is healthy."

### Step 4: Run simulation via /simulate

Once the backend is healthy, delegate to the `/simulate` skill with the user's original arguments. Default to `--quests 8` and `--rating-bias 0.7` unless the user specifies otherwise. For blocker testing, suggest `--quests 12`.

The `/simulate` skill handles argument parsing, running the script, and summarizing results.

## Rules

1. Always use `pnpm tsx` (not npx) for running scripts.
2. Do NOT try to manually orchestrate docker compose — use `pnpm dev:local:no-ngrok` which handles the full stack including the HTTP overlay, health checks, and migrations.
3. If any step fails, diagnose by checking logs before giving up. Common issues:
   - Backend won't start → check `docker compose logs backend`
   - Seed fails → the backend might not have finished migrations yet, wait and retry
   - Simulation fetch fails → backend might not be on localhost:3000, check with `curl http://localhost:3000/api/health`
4. Report estimated cost from the simulation output.
5. The simulation defaults to Frederick, CO area coordinates. Inform the user if they request a different location.
