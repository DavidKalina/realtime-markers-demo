---
description: Run a live simulation of the quest system with a generated or preset persona
argument-hint: <goal or persona> [--blocker <text>] [--quests <n>] [--email <email>]
allowed-tools: [Bash, Read, Grep]
---

# Live Simulation Runner

Run the `apps/backend/scripts/simulate-live.ts` script to simulate a user journey through the quest system.

## Arguments

The user invoked this with: $ARGUMENTS

## Instructions

Parse the user's arguments to build the command. The script supports these flags:

| Flag | Default | Description |
|------|---------|-------------|
| `--email <email>` | `user@example.com` | Seeded user account email |
| `--password <pass>` | `user123` | User password |
| `--persona <name>` | | Hardcoded persona: shy-sarah, adventurous-alex, routine-rick, comedian-carl, fitness-fiona, wallflower-wendy |
| `--goal <text>` | | Generate persona from a goal (e.g. "become a stand-up comedian") |
| `--blocker <text>` | | Inject a recurring blocker (e.g. "talking to strangers", "making phone calls"). Simulates the persona consistently avoiding this action — low ratings, solo social context, frustrated journals on matching quests. Blocker activates after quest 2. |
| `--quests <n>` | 5 | Number of quests to simulate |
| `--seed <n>` | 42 | Random seed |
| `--dry-run` | | Set up profile only, no quests |
| `--skip-profile` | | Use existing user profile |
| `--skip-fear-ladder` | | Skip fear ladder generation |
| `--model <model>` | | Override LLM model |
| `--strategy <name>` | | "monolithic" or "multi-agent" |
| `--rating-bias <0-1>` | | Override rating bias |

### Seeded accounts and passwords

| Email | Password |
|-------|----------|
| `user@example.com` | `user123` |
| `moderator@example.com` | `moderator123` |
| `admin@example.com` | `admin123` |
| `scout@example.com` | `scout123` |
| `curator@example.com` | `curator123` |

### Parsing rules

1. If the user provides a goal-like phrase (e.g. "becoming a violinist", "train for a marathon"), use `--goal`.
2. If the user names a preset persona, use `--persona`.
3. If the user mentions a blocker or struggle (e.g. "but they can't talk to strangers", "keeps chickening out of phone calls"), use `--blocker`.
4. The `wallflower-wendy` persona has a built-in blocker ("initiating conversation with strangers"). No need for `--blocker` with that persona unless overriding.
5. If the user specifies a location, note it but the script currently uses hardcoded coordinates (Frederick, CO area). Inform the user if they request a different location.
6. If the user specifies an email, look up the matching password from the seeded accounts table above.
7. Default to `--quests 5` unless specified. For blocker testing, suggest 10-12 quests (blocker detection needs 5+ completed quests to fire).
8. Always use `pnpm tsx` (not npx).

### Running

Build and run the command:

```
pnpm tsx apps/backend/scripts/simulate-live.ts [flags]
```

Use a **10-minute timeout** (600000ms). Run in the **foreground** so the user sees progress.

### Blocker simulation output

When `--blocker` is used, the output includes:
- Per-quest `>> BLOCKER TRIGGERED` indicator when the quest matches the blocked action
- `>>` markers in the journey timeline for blocked quests
- Blocker Analysis section in the final summary (trigger rate, avg rating blocked vs normal)

The backend's `buildBlockerContext` runs after 5+ completed quests and feeds detected patterns to the Strategist. Watch for quest prescriptions shifting after quest 6-7.

### Cost note

Each quest costs ~$0.02-0.05 (LLM + Google Places). Mention the estimated cost from the script output.

## Summarize results

After the simulation completes, read the output and provide a summary including:

1. **Persona**: Name, goal, barriers, pace
2. **Quest journey**: Brief table or list of each quest (title, venue, category, rating, social context)
3. **Pathway formation**: Which pathways formed (BFS vs DFS), themes
4. **Growth signals**: Phase progression, resonance trends, any blockers detected
5. **Final stats**: Total quests, avg rating, comfort radius, XP
6. **Cost**: Total estimated API cost from the output

If the simulation failed partway through, report how far it got and what the error was. Check `docker compose logs backend --tail 50` for backend errors if needed.
