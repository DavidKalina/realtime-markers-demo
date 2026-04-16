# Product Design: World Size

## Vision

An app that helps people — especially those dealing with anxiety, inertia, or homebody tendencies — gradually build the real-world muscles to leave home, be around people, and create a life outside. It does this through AI-prescribed **reps** (small brave practice steps) in real venues, calibrated to the user's current capacity, with a collectible card system that records the evidence of growth.

**Core insight:** Google Maps answers "where should I go?" This app answers "how do I become someone who goes places?"

**Positioning:** A gentle sidequest app for building the real-world muscles to leave home, be around people, and create a life outside. Capacity-building, **not** clinical therapy.

**Design philosophy:** The user should feel **accompanied, not measured.** The app prescribes one small brave rep; the user controls the boundaries. The point is not just expanding the map — it's building the user's capacity to leave, stay, return, interact, recover, and eventually belong.

---

## Core Loop

```
Observe → Prescribe a rep → Calibrate → Go → Capture → Reflect → Expand
```

1. **Observe** — App passively tracks idle location patterns. Learns home anchor, natural radius, time patterns, and capacity baselines.
2. **Prescribe a rep** — The strategist picks the **capacity rep** first (e.g., "practice Public Presence"), then selects an environment (venue) that supports it. Output is ONE prescription with full/smaller/tiny versions, a minimum viable win, and an exit ramp.
3. **Calibrate** — User responds to the prescription: *Looks good / Too social / Too far / Too public / Too much effort / Not my vibe / Bad timing / Need something gentler*. The app recalibrates rather than offering a menu of alternatives.
4. **Go** — User travels to the location. Proximity check-in confirms arrival (75m geofence). Manual check-in is a valid fallback.
5. **Capture** — Optional photo + one-line journal. Becomes the trophy card.
6. **Reflect** — Which version did they complete (full/smaller/tiny)? What did it prove they can do? Predicted vs. actual anxiety? Would they return? All optional, one-tap where possible.
7. **Expand** — Completion, rejection, and reflection data feed back into the strategist. The next prescription adjusts capacity, intensity, venue type, and pacing.

---

## The Prescription Model (Not a Picker)

The default flow is **one prescribed rep + calibration feedback**, not a three-option picker.

**Why no picker:**
- The user's problem is often inertia. Choice paralysis is a failure mode, not a feature.
- A picker lets the user bypass the strategist. The strategist is the product.
- Exposure therapy works on a calibrated hierarchy — calibration is the mechanism.

**Every prescription ships with three versions:**

| Version | Purpose | Example |
|---|---|---|
| **Full rep** | The target | Attend the board game night for 45 minutes |
| **Smaller rep** | Reduced intensity | Walk in, look around for 5 minutes, then leave |
| **Tiny rep** | Minimum viable win | Go to the entrance and decide whether to enter |

Completing the tiny version is not failure. It is a completed rep — a data point and a win.

**Every prescription must include:**
- **Minimum viable win** — what counts as "I did the thing"
- **Exit ramp** — the graceful out ("leave anytime / after X minutes / when you feel ready")
- **Why this rep** — the hook that explains what it's training
- **One stretch dimension max** — never push distance + social + novelty at once

---

## Early Calibration Mode (First 3–5 Quests)

For the user's first 3–5 quests, optimize for **trust, not growth speed.**

Early quests are almost impossible to fail:
- Short
- Nearby (inside current radius)
- Low ambiguity
- Low social demand
- Clear exit ramp
- One stretch dimension only
- Minimum viable win included

The first promise is: *"This app gets me enough that I can trust the next suggestion."* Once trust is earned, the strategist can widen the envelope.

---

## The Capacity Model

Progress is tracked by **capacity built**, not area covered.

### Capacity Tracks (the muscles)

- **Activation** — getting ready, leaving the house, starting despite inertia
- **Public Presence** — being visible in public without fleeing
- **Novelty Tolerance** — entering unfamiliar places
- **Staying Power** — remaining somewhere long enough for anxiety to settle
- **Returnability** — going back until a place feels familiar
- **Micro-Interaction** — ordering, asking, thanking, eye contact, small talk
- **Social Extension** — joining, chatting, flirting, following up
- **Recovery** — reflecting, regulating, trying again after awkwardness
- **Identity Evidence** — collecting proof that "I am someone who does this"

Every completed rep attributes to one or more capacity tracks.

### Range / Roots / Reps (the user-facing framing)

Replaces the internal BFS/DFS mental model.

- **Range** — new places, new categories, new neighborhoods (breadth)
- **Roots** — repeated places, familiarity, becoming a regular (depth)
- **Reps** — specific capacities trained across contexts

A user can make huge progress with almost no Range growth if Roots and Reps are deepening. For this audience, repetition may be more transformative than novelty. Depth is a first-class arc, not a consolation prize.

### Progress Language

Lead with capacity evidence:
- "You're building public presence."
- "You completed another activation rep."
- "This was your third return to a familiar place."
- "You stayed even after the first anxiety spike."
- "You now have evidence that you can do this."

**Avoid** (fossils from gamification framing):
- "Your score dropped."
- "Momentum is cooling."
- "You are behind."
- "Your growth rating is low."
- "Social Growth Score"

---

## The Strategist Agent

### Role

One agent. One prescription at a time. Prescriptive, not menu-based. The user does **not** request a quest — the app observes and prescribes.

### Prescription Flow

1. What capacity is the user ready to train right now?
2. What intensity is safe given recent signals?
3. What constraints matter today (timing, energy, social load)?
4. What kind of environment supports that rep?
5. Which specific venue best fits?
6. How do we frame it so it feels doable — why this rep, minimum win, exit ramp?

**Rep first, venue second.** This is the key ordering change.

### Context Available to the Agent

- Home anchor + current comfort radius + Voronoi coverage
- Capacity track estimates (which muscles are strongest / least developed)
- Completion history: where, when, which version (full/smaller/tiny), anxiety pred vs. actual
- **Rejection history with reasons** (first-class signal — see below)
- Journal entries + ratings (sentiment as signal)
- Time patterns
- Self-described constraints and goals from onboarding
- Activity preferences inferred from past completions

### Quest Output

A single prescription with:
- Venue (name, address, category, coordinates)
- The **rep** being trained (capacity track + intent)
- Full / smaller / tiny versions of the rep
- Minimum viable win + exit ramp
- Why this rep (the hook)
- Distance from home + stretch context (make the stretch visible and honest)
- Suggested activities (3–4 casual ideas framed as "people do these things here" — not assignments)

---

## Calibration Feedback & Rejection as Data

**Rejecting a prescription is not failure — it is signal.**

### Calibration Responses

When the user sees a prescription, they can respond:
- **Looks good** — proceed to Start
- **Too social**
- **Too far**
- **Too public**
- **Too much effort**
- **Not my vibe**
- **Bad timing**
- **Need something gentler**

The app does not show alternatives. It **recalibrates** and prescribes again, explicitly acknowledging the lever: *"Good signal. That was too social for today. I'll keep the activation rep but make the next one more solo."*

### Rejection Pattern Detection

If the user rejects for the same reason repeatedly (e.g., "too social" three times in a row), the strategist auto-adjusts the envelope — lowering intensity on that dimension and prioritizing the tiny version on the next prescription.

### Primary Learning Signals

Rating is useful but not the gate. Richer signals:
- Started vs. avoided
- Which version completed (full / smaller / tiny)
- Predicted anxiety vs. actual
- Time-to-start
- Rejection reasons
- Would-return
- Journal/reflection content
- Repeated-venue tolerance (Roots signal)

---

## The Validator

The validator is one of the most important systems in the app. A bad quest is not just a bad recommendation — it is a trust break.

**Reject any prescription that:**
- Violates a hard-no boundary from onboarding or rejection history
- Stretches multiple dimensions at once (distance + social + novelty)
- Lacks a minimum viable win
- Lacks an exit ramp
- Is too far for the current baseline
- Repeats a recently rejected pattern
- Is likely closed / expensive / crowded / logistically broken
- Does not clearly train the intended capacity

In early calibration mode, the validator enforces additional constraints: distance ≤ current radius, one stretch dimension only, explicit exit ramp.

---

## Home Screen: Today's Rep First

The dashboard does **not** lead with analytics.

Lead with:
1. **Today's rep** — the prescription
2. **Why this rep** — the hook
3. **Minimum win** — what counts
4. **Make it gentler** — one-tap request for the smaller/tiny version
5. **Start**

Underneath, supporting context:
- Capacity tracks (evidence, not score)
- Recent cards
- Familiar places (Roots)
- Pathways (human arcs)
- Reflections
- Range / World Size as supporting context

The user should feel **accompanied, not measured.**

---

## Trophy Card System

### Core Concept

Cards are **earned, not generated.** Your deck grows as your capacity grows. Each completed rep becomes a collectible card.

Each card answers one question: **"What did this prove I can do?"**

Examples:
- "Left the house on a low-energy morning"
- "Stayed in public for 12 minutes"
- "Returned to the same place for the third time"
- "Asked one tiny question"
- "Did the smaller version instead of disappearing"
- "Recovered after feeling awkward"

### Card Anatomy

- **Art** — user's photo at check-in (fallback: generated art from venue category)
- **Title** — the rep or venue
- **Date**
- **Capacity** — which muscles it trained
- **Version** — full / smaller / tiny (all valid)
- **Distance** — how far from home
- **Journal snippet** — the one-line reflection
- **Rarity** — relative to the user's comfort envelope at the time of completion (not absolute distance)

### Rarity System

Rarity is relative to the user's **capacity and comfort envelope at the time of the quest**:

- **Common** — inside current envelope, familiar category
- **Uncommon** — at the edge, or a slight stretch on one dimension
- **Rare** — beyond envelope on one dimension
- **Epic** — beyond envelope on multiple dimensions
- **Legendary** — a significant personal milestone (first return to a feared place, first micro-interaction in a new context, first time in a new region)

Early cards will mostly be Common. That's fine. Scrolling through the deck months later and seeing the rarity gradient **is** the progress visualization.

---

## World Size (Supporting Signal)

World Size — the polygon area of all completed quest locations — is kept, but **demoted** to one supporting signal under Range. It no longer defines success on its own.

**Why:** Many users will heal most on Roots (becoming regulars) with almost no Range growth. A metric that only rewards breadth would accidentally punish the right behavior.

World Size is displayed as context ("Your world is 12 sq mi") alongside capacity evidence, Roots depth, and recent reps. It only grows, never shrinks, never penalizes missed weeks.

### Voronoi Coverage

The Voronoi tessellation of check-in clusters (Phases 1–2 implemented) provides **directional intelligence** to the strategist — "you haven't explored southeast" — and anchors the visual coverage map. Rarity is boosted when a quest targets a coverage gap.

---

## Pathways: Human Arcs, Not Venue Categories

Pathways are named after the arc of the growth, not the type of venue:

- Leaving the House
- Quiet Public Presence
- Cafe Regular
- Low-Stakes Interaction
- Familiar Places
- New Neighborhoods
- Group Activity Practice
- Date-Ready Confidence
- Recovery After Awkwardness
- Becoming Recognized

A pathway is a sequence of reps across contexts that together train a capacity. Example — **Cafe Regular**:
1. Visit the same cafe once.
2. Return at the same time next week.
3. Sit for 10 minutes.
4. Order without rehearsing too much.
5. Make eye contact and say thanks.
6. Ask one tiny question.
7. Become comfortable being recognized.

That is a real social-capacity arc, and it barely moves World Size.

---

## Proximity Building (Roots)

Roots is first-class, not a post-MVP afterthought. For someone trying to meet people, going to the same coffee shop five times is more valuable than five different coffee shops once.

### The Mechanic

After check-in, the capture modal offers: **"Would you like to come back here?"**

- **Yes** → the venue enters a Roots loop. The app re-prescribes the same spot on a cadence instead of generating a new quest. Each return earns a **proximity card** tracking depth, not breadth.
- **No / Skip** → normal flow. Next prescription is somewhere new.
- **Turn off anytime** → the user can exit the loop once the venue feels safe.

### Proximity Cards vs. Trophy Cards

| | Trophy Card | Proximity Card |
|---|---|---|
| **Earned by** | First visit to a new place | Repeat visit to a building spot |
| **Rarity** | Stretch at time of completion | Visit count (3× silver, 5× gold, 10× platinum) |
| **Measures** | Range | Roots |
| **Capacity signals** | Novelty Tolerance, Activation | Returnability, Micro-Interaction |

---

## Onboarding: Boundaries and Capacity

Onboarding establishes the **consent envelope** — what the user is willing to attempt, and what to stay away from.

Ask:
- What feels impossible right now?
- What feels scary but maybe possible?
- What already feels okay?
- What kinds of places feel safe?
- What contexts spike anxiety?
- What is your current leaving-the-house baseline?
- What usually stops you?
- Pace preference: gentle / steady / push me

Then pick a goal: social confidence, making friends, dating, getting out more, rebuilding after a hard stretch, exploring a new city. Goals outside the app's scope get an `out_of_scope` classification with a warm reframe toward the slice the app can help with.

---

## Persona Simulations as Calibration Safety Tests

Simulations are regression tests for calibration correctness, not just output samples. Personas:

- Very anxious homebody
- Lonely but motivated
- Dating-focused avoidant
- Burned out and low-energy
- Socially capable but new city
- Adventurous but inconsistent
- Rejection-sensitive
- Overcommits then avoids

If the anxious homebody gets a crowded meetup on quest 2, the system fails. Calibration correctness is a testable property, not vibes.

---

## What Changes from Current Architecture

### Keeps (works as-is or with minor reframing)
- Proximity check-in (75m geofence, PostGIS)
- Activity heatmap (16-week visualization)
- Trophy card UI (QuestCardDeck, swipe, animations)
- Voronoi coverage system (Phases 1–2)
- Push notifications on check-in / completion / milestones
- Share tokens for sharing individual cards
- Fear ladder / expectancy calibration data model
- Rejected-venue blocklist (needs extension — see below)

### Evolves
- **Quest generation** — strategist picks the **capacity rep first**, then the venue
- **Quest output** — adds full / smaller / tiny versions, minimum viable win, exit ramp
- **Home screen** — leads with today's rep, not analytics
- **Progress model** — capacity tracks become primary; World Size / radius demoted to supporting
- **Rejection tracking** — extends venue-level blocklist into structured rejection reasons feeding recalibration
- **Validator** — adds multi-dimension stretch detection, early-phase constraints, rejection-pattern override
- **Writer agent** — emits quest variants (full/smaller/tiny), minimum win, exit ramp
- **Card semantics** — "what did this prove I can do?" framing over "what place did I visit"
- **Pathways** — named as human arcs rather than venue categories
- **Progress language** — capacity-evidence phrasing; drop score/momentum/falling-behind copy

### New
- Calibration feedback widget (reject-with-reason on each prescription)
- Capacity track matrix on the user profile
- `minViableWin`, `exitRamp`, and version-variant fields on Objective
- Structured `RejectionReason` enum + persistence
- Rejection-pattern detector in the prescription context builder
- Early-calibration-mode phase flag + validator constraints
- Range / Roots / Reps unified progress taxonomy in mobile UI
- Richer reflection prompts that extract capacity evidence

### Drops
- 3-tier parallel generation (QUICK / SWEET_SPOT / BEST)
- Concept picker as a required step (picker flow is retired as the default path)
- User-initiated quest prompts (app prescribes; user doesn't request)
- Browse / publish marketplace for shared quests, `timesAdopted`, `isPublished`
- Scan / discovery counts (`scan_count`, `discovery_count`, `weekly_scan_count`)
- XP-based tier progression (`currentTier`)
- Tier promotion mechanic (replaced by rarity + capacity evidence)
- Social Growth Score / "momentum cooling" / "behind" language

---

## Open Questions

- **Quest cadence** — one per day (current)? one per week? On-demand after completion? How does cadence interact with the calibration loop?
- **Re-engagement** — what happens after 2+ weeks of inactivity? The current contraction mechanic may pressure users rather than protect them; re-evaluate against the "accompanied, not measured" principle.
- **Social** — sharing cards? seeing friends' capacity growth? Or deliberately solo?
- **Monetization** — freemium? subscription? free vs. paid split?
- **Onboarding depth** — how much to ask upfront vs. learn over time without eroding trust?
- **Photo storage** — S3/DigitalOcean Spaces at scale
- **Range / Roots balance** — is the mix automatic (inferred from goal + capacity gaps) or user-controlled?
- **Capacity inference** — how confidently can we attribute a completion to specific capacity tracks without an explicit user tag?
