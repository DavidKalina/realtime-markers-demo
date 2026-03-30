# Product Design: World Size

## Vision

An app that helps people — especially those dealing with anxiety, inertia, or homebody tendencies — gradually expand their real-world comfort zone through AI-prescribed quests, gamified progression, and a collectible card system that visualizes their growing world.

**Core insight:** Google Maps answers "where should I go?" This app answers "how do I become someone who goes places?"

**Design philosophy:** Snow globe of your real-world effort. Every screen is a diorama of the user's progress. Addicted to progress, not the app.

---

## Core Loop

```
Observe → Prescribe → Go → Capture → Reflect → Expand
```

1. **Observe** — App passively tracks idle location patterns. Learns home anchor, work anchor, natural radius, time patterns.
2. **Prescribe** — LLM agent analyzes patterns + history and prescribes one well-calibrated quest. Slight stretch on one dimension (distance OR category, not both).
3. **Go** — User travels to the location. Proximity check-in confirms arrival (75m geofence).
4. **Capture** — Optional photo at check-in. Becomes the trophy card art.
5. **Reflect** — Prompted journal ("How did that feel?" / "Would you come back?"). Mark what activity they did from suggestions or enter their own. All optional, one-tap.
6. **Expand** — Completion feeds back into the agent. World Size grows. Comfort radius adjusts. Next quest calibrates accordingly.

---

## Progressive Expansion Mechanic

### Phase 1: Calibration (Week 0-1)

- Collect idle location data to establish home anchor and natural radius
- Lightweight onboarding:
  - "How would you describe your comfort zone?"
  - "What keeps you from getting out more?"
  - Activities they enjoy or are curious about
  - Pace preference (gentle / steady / push me)
- First quests are **inside** the current comfort zone. The win is completing something, not distance.

### Phase 2: Building the Habit (Weeks 1-4)

- One quest at a time. Simple, achievable, low-stakes.
- Quests at or near current comfort radius
- Focus: consistency over ambition
- Build the loop: get quest → go → check in → see card → feel good → want another

### Phase 3: Gradual Expansion (Weeks 4+)

- Agent begins nudging one dimension at a time:
  - **Distance stretch**: familiar category, further out ("a cafe, but in the next town")
  - **Category stretch**: same distance, unfamiliar type ("a trail instead of a cafe")
  - Never both at once — that's how exposure therapy works
- Expansion rate adapts to the user:
  - Crushing it? Bigger nudges.
  - Skipped last week? Gentler re-engagement quest, closer to home.
  - The radius is a living thing, not a timer.

### Expansion Inputs

The agent calibrates based on:
- Completion rate and consistency
- Ratings and journal sentiment
- Distance history (are they trending outward?)
- Category diversity (are they branching out?)
- Time patterns (when they actually go)
- Explicit pace preference from onboarding

---

## The LLM Agent

### Role

One agent. One quest at a time. Prescriptive, not menu-based.

The user does **not** request quests. The app observes and prescribes. This is the key difference from the current "generate 3 options" model.

### Context Available to Agent

- Home anchor + current comfort radius
- Completion history: where, when, how far, what categories
- Journal entries + ratings (sentiment as signal)
- Time patterns (when they're most likely to go out)
- User's self-described anxiety/goals/pace from onboarding
- Activity preferences (from past marked activities)

### Quest Output

A single quest with:
- Venue (name, address, category, coordinates)
- Why this quest (the hook — "you've never been to this part of town" or "this is your kind of spot but a little further out")
- Distance from home + distance from their usual radius (make the stretch visible)
- Suggested activities (3-4 casual ideas based on venue type)

### Activity Suggestions

Per-venue suggestions framed as "people do these things here" — not assignments.

Examples:
- **Park**: walk the loop, bring a book, sketch, toss a frisbee, longboard
- **Cafe**: try their specialty, bring work, people-watch
- **Trail**: hike to the lookout, take a photo of something weird, bring a podcast
- **Museum**: pick one exhibit, sketch something, find the weirdest piece

Rules:
- 3-4 ideas max. Casual tone.
- Not required. Not scored. Not graded.
- Post-visit: user taps what they did or enters "other"
- Feeds back into agent: "this person longboards at parks" → future park quests lean into that

---

## Trophy Card System

### Core Concept

Cards are **earned, not generated.** Your deck grows as your world grows. Each completed quest becomes a collectible trophy card.

### Card Anatomy

- **Art**: Photo the user took at check-in (fallback: generated art from venue category)
- **Title**: Venue name or quest title
- **Date**: When they went
- **Distance**: How far from home
- **Activity**: What they did there ("longboarded")
- **Journal snippet**: Their one-line reflection
- **Rarity**: Based on how far outside their comfort zone at the time of completion

### Rarity System

Rarity is relative to the user's comfort zone **at the time of the quest**, not absolute distance:

- **Common**: Within current comfort radius, familiar category
- **Uncommon**: At the edge of comfort radius, or unfamiliar category
- **Rare**: Beyond comfort radius on one dimension
- **Epic**: Beyond comfort radius on multiple dimensions
- **Legendary**: First time in a new city/region, or a significant personal milestone

Early cards will mostly be Common. That's fine. Scrolling through your deck months later and seeing the rarity gradient from Common → Legendary **is** the progress visualization.

### Deck as Progress

- Scrolling your deck = scrolling your growth story
- Early cards: familiar spots, short distances, common rarity
- Later cards: new neighborhoods, longer distances, higher rarity
- The collection itself tells the story without needing a separate stats screen

---

## World Size (Primary Metric)

### Concept

The area of the polygon formed by all completed quest locations. It only grows. Never shrinks. Never penalizes.

**Display**: "Your world is 12 sq mi and growing" with a visual shape on the map.

### Why Not a "Health Score"

- People with anxiety don't need a number going down when they miss a week
- A score implies judgment. World Size implies exploration.
- It only expands — every quest permanently adds to it
- Missing a week doesn't shrink your world. It just doesn't grow it.

### Supporting Metrics (non-punitive, growth-only)

- **Streak**: Consecutive weeks with a completion. Resets but doesn't penalize.
- **Depth vs Breadth**: Unique places vs revisits. Both are valid. Revisiting a discovered spot is also growth.
- **Category diversity**: How many different types of venues. Visualized, not scored.
- **Distance trajectory**: Trending graph of quest distances over time.

### Future: Voronoi Coverage Map

Voronoi tessellation of completed quest locations overlaid on a real map. Visual representation of "territory covered." Out of scope for now but the data model supports it — every objective already has coordinates.

---

## What Changes from Current Architecture

### Keeps (works as-is or with minor reframing)
- Streak system (weekly consistency tracking)
- Proximity check-in (75m geofence, PostGIS)
- Activity heatmap (16-week visualization)
- Venue DNA / Activity DNA (reframe as wellness profile)
- Trophy card UI (QuestCardDeck, swipe, animations)
- Push notifications on check-in/completion/milestones
- Share tokens for sharing individual cards

### Evolves
- **Quest generation**: From "user requests 3 options" → "agent prescribes 1 quest based on patterns"
- **3-tier system**: From quality tiers (Quick/Sweet Spot/Best) → comfort zone tiers (rarity)
- **Objective model**: Add `suggestedActivities` array, `photoUrl`, `journalEntry`, `completedActivity` fields
- **User model**: Add home anchor, comfort radius, pace preference, expansion history
- **Profile screen**: From stat sheet → world size visualization + card collection

### New
- Idle location tracking + home anchor detection
- Comfort radius calculation + expansion algorithm
- Journal prompts (lightweight, post-visit)
- Photo capture at check-in
- World Size polygon calculation
- Rarity assignment based on relative comfort zone
- Onboarding flow for anxiety/goals/pace

### Drops
- 3 parallel generation agents (cost savings + simpler UX)
- User-initiated quest prompts (app prescribes, user doesn't request)
- Browse/search public quests (may return later but not core to wellness loop)
- Tier promotion mechanic (replaced by rarity)

---

## Open Questions

- **Quest cadence**: One per week? On-demand after completion? Drip-fed?
- **Re-engagement**: What happens after 2+ weeks of inactivity? Gentle push notification? Quest closer to home?
- **Social**: Is there a social component? Sharing cards? Seeing friends' world sizes? Or is this deliberately solo?
- **Monetization**: Freemium? Subscription? What's free vs paid?
- **Onboarding depth**: How much do we ask upfront vs learn over time?
- **Photo storage**: S3/DigitalOcean Spaces (already have infra) — but adds storage costs at scale
