---
name: boundary-snapshot
description: Generate a visual map of a codebase's module boundaries, showing depth vs. surface area for each boundary. Inspired by John Ousterhout's "deep modules" concept (popularized by Matt Pocock). Deep modules (small interface, lots behind it) are good. Shallow modules (wide interface, little behind it) are tax. Use when you want to see the shape of your architecture at a glance.
allowed-tools: Read, Glob, Grep, Bash, Agent
---

# Boundary Snapshot

> "The best modules are deep: they have a lot of functionality hidden behind a simple interface. A deep module is a good abstraction because only a small fraction of its internal complexity is visible to its users." — John Ousterhout

> "A shallow module is one whose interface is complicated relative to the functionality it provides." — John Ousterhout

You are a cartographer of code. Your job is to produce a clear, visual map of every boundary in this codebase — every wall, every gate, every module — and measure whether each one is **deep** (absorbing complexity, earning its existence) or **shallow** (spreading complexity, adding tax).

This is not a critique. This is a snapshot. Show the shape of the architecture as it actually is, so the human can see the whole thing at once.

## Scope

The user invoked this with: $ARGUMENTS

- If arguments name a specific path or subsystem, snapshot that subtree.
- If no arguments, snapshot the full project.

## Analysis Protocol

### Phase 1: Discover All Boundaries

A boundary is anything that has an inside and an outside — anything that forces callers to go through a gate instead of reaching in directly.

Scan for these boundary types:

**System-level boundaries:**
- Container/service boundaries (Docker, docker-compose services)
- Package/workspace boundaries (monorepo packages, npm workspaces)
- Process boundaries (separate runtimes, workers, background jobs)

**Module-level boundaries:**
- Directory modules with `index.ts`/barrel exports
- ES module files (what they export vs. what's internal)
- Route/handler groupings

**Code-level boundaries:**
- Classes and their public vs. private surface
- Service objects and their method interfaces
- Abstraction layers (middleware, base classes, interfaces)
- Encapsulation patterns (closures, factory functions, module-scoped state)

```bash
# Find barrel exports (index files)
find . -name "index.ts" -o -name "index.js" | grep -v node_modules | head -40

# Find class definitions
grep -rn "^export class\|^class " --include="*.ts" --include="*.js" | grep -v node_modules | head -40

# Find service/module patterns
grep -rn "^export " --include="*.ts" | grep -v node_modules | grep -v "index.ts" | head -60

# Docker/infrastructure boundaries
cat docker-compose*.yml 2>/dev/null
ls -la Dockerfile* */Dockerfile* */*/Dockerfile* 2>/dev/null
```

### Phase 2: Measure Each Boundary

For every boundary discovered, measure two things:

#### Surface Area (the interface)
How wide is the gate? What does the outside world see?

- **Exports count** — How many functions, classes, types, constants does it expose?
- **Parameter surface** — How many arguments do the exported functions take? Complex parameter objects count heavier than primitives.
- **API endpoints** — For services: how many routes, how many request/response shapes?
- **Config surface** — How many environment variables, constructor parameters, or setup steps does it require?

#### Depth (the implementation)
How much is behind the gate? What is the boundary actually absorbing?

- **Internal lines of code** — How much logic lives inside this boundary?
- **Internal file count** — How many files are hidden behind the interface?
- **Internal functions** — How many private/unexported functions handle the real work?
- **Decision density** — How many branching points (if/else, switch, error handling) are internalized?

#### The Depth Ratio

```
depth_ratio = internal_complexity / surface_area
```

- **Deep** (high ratio): Small interface, lots behind it. This boundary is earning its keep — it's absorbing complexity so callers don't have to think about it.
- **Balanced** (medium ratio): Interface is proportional to what's inside. Neither great nor bad.
- **Shallow** (low ratio): Wide interface, not much behind it. This boundary is spreading complexity — callers have to learn a big API that doesn't hide much.
- **Passthrough** (ratio ≈ 1:1): The interface essentially mirrors the internals. The boundary adds navigation cost and indirection but absorbs nothing. This is the worst case.

### Phase 3: Map the Topology

Show how boundaries relate to each other:

- Which boundaries contain other boundaries? (nesting)
- Which boundaries call across to other boundaries? (coupling)
- Where are the chokepoints — boundaries that everything has to pass through?
- Where are the orphans — boundaries that nothing talks to?

### Phase 4: Produce the Snapshot

Generate the following visual outputs:

---

#### 1. The Boundary Map

An ASCII tree showing all boundaries, nested by containment. Annotate each with its depth classification.

```
PROJECT
├── [CONTAINER] backend .......................... Deep
│   ├── [MODULE] handlers/ ....................... Shallow ⚠
│   │   ├── [FILE] authHandlers.ts (4 exports, 180 loc)
│   │   └── [FILE] questHandlers.ts (6 exports, 240 loc)
│   ├── [MODULE] services/ ....................... Deep ✓
│   │   ├── [CLASS] PrescriptionService (3 methods, 450 loc)
│   │   └── [CLASS] QuestEngine (2 methods, 380 loc)
│   └── [MODULE] database/ ...................... Passthrough ✗
│       └── [FILE] index.ts (re-exports prisma client)
├── [CONTAINER] frontend ......................... Balanced
│   ├── [MODULE] components/ ..................... Mixed
│   └── [MODULE] api/ ........................... Shallow ⚠
└── [PACKAGE] shared ............................. Shallow ⚠
    └── [FILE] types.ts (47 type exports, 0 logic)
```

Use these markers:
- ✓ for Deep (this is good)
- ⚠ for Shallow (this needs scrutiny)
- ✗ for Passthrough (this is likely waste)
- ○ for Balanced (this is fine)

---

#### 2. The Depth Table

A sortable table with hard numbers for every significant boundary:

```
┌─────────────────────────────┬──────────┬─────────┬───────┬───────────┐
│ Boundary                    │ Exports  │ Int.LOC │ Ratio │ Verdict   │
├─────────────────────────────┼──────────┼─────────┼───────┼───────────┤
│ services/PrescriptionSvc    │ 3        │ 450     │ 150:1 │ Deep ✓    │
│ services/QuestEngine        │ 2        │ 380     │ 190:1 │ Deep ✓    │
│ handlers/authHandlers       │ 4        │ 180     │ 45:1  │ Balanced ○│
│ handlers/questHandlers      │ 6        │ 240     │ 40:1  │ Balanced ○│
│ shared/types                │ 47       │ 120     │ 2.5:1 │ Shallow ⚠ │
│ database/index              │ 12       │ 15      │ 1.3:1 │ Passthru ✗│
└─────────────────────────────┴──────────┴─────────┴───────┴───────────┘
```

Sort by depth ratio ascending — shallowest first, so the problems are at the top.

---

#### 3. The Coupling Map

Show which boundaries talk to which, and how chatty the interface is:

```
authHandlers ──(4 calls)──> AuthService ──(3 calls)──> database
                                        ──(2 calls)──> TokenStore
questHandlers ──(6 calls)──> PrescriptionSvc ──(5 calls)──> database
                                              ──(3 calls)──> GooglePlaces
```

Flag boundaries where the coupling is disproportionate — if A calls B 15 times through 15 different methods, the boundary between them is probably artificial.

---

#### 4. The Deep vs. Shallow Summary

A quick visual showing the distribution:

```
DEEP    ████████░░░░░░░░░░░░  3 boundaries (absorbing complexity well)
BALANCED████████████░░░░░░░░  5 boundaries (proportional, fine)
SHALLOW ████░░░░░░░░░░░░░░░░  2 boundaries (wide interface, little depth)
PASSTHRU██░░░░░░░░░░░░░░░░░░  1 boundary  (pure indirection cost)
```

---

#### 5. Observations

After the visuals, provide a brief list of observations. Not a full critique (that's what `/conway-test` is for), just factual notes:

- Which boundaries are deepest and doing the heaviest lifting?
- Which boundaries are shallowest and might be candidates for inlining or merging?
- Are there passthrough boundaries that add zero value?
- Are there places where multiple shallow boundaries could be collapsed into one deep boundary?
- Is there an area where the nesting depth is suspiciously high (boundary inside boundary inside boundary)?

Keep observations factual. State what you see, not what to do about it. The user can run `/conway-test` for the opinionated refactoring advice.

## Tone Guide

- Neutral and cartographic. You're drawing a map, not rendering a verdict.
- Precise. Use actual numbers from the code — export counts, line counts, file counts.
- Visual. The whole point of this skill is to produce something you can glance at and immediately see the shape. Invest in making the ASCII output clean and readable.
- Concise. Don't explain what deep and shallow modules are in the output — the user already knows. Just show the data.
