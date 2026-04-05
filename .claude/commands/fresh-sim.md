---
description: Full reset + simulation — tears down Docker, rebuilds via dev:local:no-ngrok, wipes DB, seeds users, runs a simulation, and summarizes results
argument-hint: <goal or persona> [--blocker <text>] [--quests <n>] [--email <email>]
allowed-tools: [Bash, Read, Grep]
---

# Fresh Simulation (Full Reset)

Tears down the entire environment, starts it via `pnpm dev:local:no-ngrok`, wipes the database, seeds users, runs a live simulation, and provides a summary.

## Arguments

The user invoked this with: $ARGUMENTS

## Steps

Follow these steps **exactly and sequentially**. Do NOT skip steps. Report progress to the user at each stage.

### Step 1: Kill any existing dev environment

Kill any running dev-local.sh process and tear down containers:

```bash
pkill -f "dev-local.sh" 2>/dev/null || true
pkill -f "expo start" 2>/dev/null || true
docker compose down -v
```

Report: "Environment torn down."

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

### Step 4: Seed users

The dev script may have already seeded, but run it to be sure:

```bash
docker exec realtime-markers-demo-backend-1 sh -c "cd /app/apps/backend && bun run scripts/seed.ts" 2>&1
```

Use a 30-second timeout. If the container name doesn't match, find it:

```bash
docker ps --format '{{.Names}}' | grep backend
```

Report: "Users seeded."

### Step 5: Run the simulation

Parse the user's `$ARGUMENTS` to build the simulate command:

| Rule                | Description                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Goal-like phrase    | Use `--goal "<text>"`                                                                                              |
| Preset persona name | Use `--persona <name>` (shy-sarah, adventurous-alex, routine-rick, comedian-carl, fitness-fiona, wallflower-wendy) |
| Blocker mention     | Use `--blocker "<text>"`                                                                                           |
| Quest count         | Use `--quests <n>`, default 8                                                                                      |
| Email specified     | Use `--email <email>` and look up password from seeded accounts                                                    |
| Rating bias         | Use `--rating-bias <0-1>`, default 0.7 for positive-leaning sims                                                   |

**Seeded accounts:**

| Email                   | Password       |
| ----------------------- | -------------- |
| `user@example.com`      | `user123`      |
| `moderator@example.com` | `moderator123` |
| `admin@example.com`     | `admin123`     |
| `scout@example.com`     | `scout123`     |
| `curator@example.com`   | `curator123`   |

Default to `--quests 8` and `--rating-bias 0.7` unless the user specifies otherwise. For blocker testing, suggest `--quests 12`.

Run the simulation:

```bash
pnpm tsx apps/backend/scripts/simulate-live.ts [flags]
```

Use a **10-minute timeout** (600000ms). Run this in the **foreground** so the user sees progress.

### Step 6: Summarize results

After the simulation completes, read the output and provide a summary including:

1. **Persona**: Name, goal, barriers, pace
2. **Quest journey**: Brief table or list of each quest (title, venue, category, rating, social context)
3. **Pathway formation**: Which pathways formed (BFS vs DFS), themes
4. **Growth signals**: Phase progression, resonance trends, any blockers detected
5. **Final stats**: Total quests, avg rating, comfort radius, XP
6. **Cost**: Total estimated API cost from the output

If the simulation failed partway through, report how far it got and what the error was. Check `docker compose logs backend --tail 50` for backend errors if needed.

## Rules

1. Always use `pnpm tsx` (not npx) for running scripts.
2. Do NOT try to manually orchestrate docker compose — use `pnpm dev:local:no-ngrok` which handles the full stack including the HTTP overlay, health checks, and migrations.
3. If any step fails, diagnose by checking logs before giving up. Common issues:
   - Backend won't start → check `docker compose logs backend`
   - Seed fails → the backend might not have finished migrations yet, wait and retry
   - Simulation fetch fails → backend might not be on localhost:3000, check with `curl http://localhost:3000/api/health`
4. Report estimated cost from the simulation output.
5. The simulation defaults to Frederick, CO area coordinates. Inform the user if they request a different location.
