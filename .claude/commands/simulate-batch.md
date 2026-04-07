---
description: Run multiple live simulations concurrently with different configs, then analyze and compare results
argument-hint: <count> simulations [with specific goals/personas/flags]
allowed-tools: [Bash, Read, Grep, Glob, Agent]
---

# Batch Simulation Runner

Run multiple `apps/backend/scripts/simulate-live.ts` simulations **concurrently**, then analyze and compare the results.

## Arguments

The user invoked this with: $ARGUMENTS

## Instructions

### 1. Parse the user's request

Determine what simulations to run. The user may specify:

- A number of simulations (e.g. "5 sims", "3 concurrent runs")
- Specific goals, personas, or flag combos for each
- A quest count per simulation (default 8)
- General guidance like "mix of goals and personas" or "all goal-based"

If the user is vague, design a diverse set that covers different flags:

| Flag | Description |
|------|-------------|
| `--goal <text>` | Generate persona from a goal |
| `--persona <name>` | Preset: shy-sarah, adventurous-alex, routine-rick, comedian-carl, fitness-fiona, mover-mike, wallflower-wendy |
| `--blocker <text>` | Inject a recurring blocker |
| `--challenge-mix <n>` | Every Nth quest is a challenge quest |
| `--week-packs` | Use week-pack prescription (3 per pack) |
| `--rating-bias <0-1>` | Override rating bias |
| `--quests <n>` | Number of quests (default 5) |
| `--seed <n>` | Random seed |

### 2. Assign unique seeds and emails

Each concurrent simulation **must** use a different `--seed` and `--email` to avoid collisions.

Seeded accounts:

| Email | Password |
|-------|----------|
| `user@example.com` | `user123` |
| `scout@example.com` | `scout123` |
| `curator@example.com` | `curator123` |
| `moderator@example.com` | `moderator123` |
| `admin@example.com` | `admin123` |

If running more than 5 simulations, reuse emails sequentially (the script wipes and re-profiles each run).

### 3. Show the plan

Before running, show the user a table of what you're about to launch:

```
| # | Label | Flags | Email | Seed |
|---|-------|-------|-------|------|
| 1 | Comedian (goal) | --goal "become a stand-up comedian" --quests 8 | user@example.com | 1 |
| 2 | Surfer (goal) | --goal "learn to surf" --quests 8 | scout@example.com | 2 |
| ...
```

### 4. Launch all simulations concurrently

Run each simulation as a **background** Bash command, piping output to a unique log file:

```bash
pnpm tsx apps/backend/scripts/simulate-live.ts [flags] 2>&1 | tee /tmp/sim-batch-{N}.log
```

- Use `run_in_background: true` for each
- Use a **10-minute timeout** (600000ms)
- Launch ALL simulations in a **single message** with parallel tool calls

### 5. Wait for all to complete

You'll be notified as each background task finishes. Wait for all to complete before analyzing.

### 6. Read all log files and analyze

Read each `/tmp/sim-batch-{N}.log` file. For each simulation, extract:

- Persona name and goal
- Quest journey (titles, venues, categories, ratings, social context)
- Pathway formation (BFS/DFS, themes)
- Phase progression
- Resonance trends
- Blocker detection (if applicable)
- Final stats (avg rating, comfort radius, XP)
- Cost

### 7. Comparative analysis

After extracting individual results, provide a **cross-simulation comparison**:

1. **Summary table**: One row per sim — persona/goal, quests completed, avg rating, avg resonance, final phase, pathways formed, cost
2. **Progression comparison**: Which sims showed the most growth? Which plateaued?
3. **Pathway diversity**: Did different goals/personas produce different pathway themes? Or did they converge?
4. **Resonance patterns**: Which configs produced the highest/lowest resonance? Any correlation with rating bias, social escalation, or quest type?
5. **Flag effectiveness**: How did `--challenge-mix`, `--week-packs`, `--blocker` etc. affect outcomes compared to vanilla runs?
6. **Anomalies**: Any unexpected behavior — stuck phases, zero-resonance quests, blocker false positives, etc.
7. **Total cost**: Sum across all simulations

## Rules

1. Always use `pnpm tsx` (not npx).
2. Each sim MUST have a unique seed (use 1, 2, 3, ...).
3. Each sim MUST have a unique email to avoid DB conflicts.
4. Launch all sims in a SINGLE message with parallel Bash calls.
5. If a simulation fails, still analyze the ones that succeeded and note the failure.
6. Report estimated cost per simulation and total.
7. Keep the final analysis focused and actionable — highlight what's interesting, not just raw data.
