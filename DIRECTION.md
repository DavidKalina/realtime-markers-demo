# Product Direction: "A Third Space in Your Pocket"

> Your neighborhood is more alive than your phone makes it look.
> Point your camera at any flyer and make it real for everyone around you.

---

## Core Thesis

Third places — cafes, parks, community centers, open mics, pickup games — are disappearing from American life. The events still happen, but they're invisible: stapled to telephone poles, chalked on sandwich boards, pinned to coffee shop corkboards. This app digitizes the long tail of local culture and makes it discoverable, social, and alive.

The input is the physical world. The output is a living map of what's happening near you, powered by the people who actually go outside.

---

## What's Special (Protect These)

### The Scan-to-Map Pipeline

The core differentiator. Camera → gpt-4o vision → structured event data → real-time map marker. No forms, no typing. Point and shoot. This is the identity of the product and should be treated as sacred.

- Multi-event detection from single images (community boards)
- Duplicate prevention via fingerprinting + vector similarity
- SSE streaming so users watch the AI "think" in real-time
- Sub-500ms delivery to nearby users via Redis → filter-processor → WebSocket → RBush

### Per-User Viewport Spatial Filtering

Not a broadcast. Each user only receives events within their visible map bounds. Computed in real-time with RBush spatial indexing and a two-tier batching strategy (150ms debounce + 2s sweep). This is what makes the real-time feel magical without melting phones.

### Physical-to-Digital Bridge

Every city has thousands of events that never touch Eventbrite or Facebook. Flyers, chalkboards, church bulletins, community boards. We digitize what others ignore.

---

## What to Build Next (Priority Order)

### 1. Gamification System (The "Level Up" Promise)

The tagline promises progression. Deliver it.

**Scanner Tiers:**

- Explorer (0-10 scans) — just getting started
- Scout (11-50 scans) — knows the neighborhood
- Curator (51-200 scans) — trusted source
- Ambassador (200+) — community pillar

**Mechanics:**

- XP earned per scan, bonus for first-to-scan an event
- Weekly challenges ("Scan 3 flyers this week," "Discover an event in a new category")
- Streak tracking (consecutive days/weeks with a scan)
- Neighborhood leaderboards (top scanners in your area)
- Visual progression on profile (tier badge, XP bar)

**Why it matters:** Gives scanners identity and motivation. Turns a utility into a habit. The people who scan are your most valuable users — reward them.

**Infrastructure ready:** `User.scanCount`, `User.discoveryCount`, `User.weeklyScanCount` already exist. Needs: XP column, tier calculation, challenge system, leaderboard queries.

### 2. Social Proof on the Map

The single biggest driver of event attendance is knowing other people are going.

**On markers:**

- Show RSVP/save count: `🎵 +23 going`
- Show friends going (when social graph exists): `🎵 3 friends saved`
- "Trending" indicator for events with rapid engagement growth

**On event details:**

- Avatars of people who RSVP'd (or count if no social graph yet)
- "X people discovered this today"
- Scanner attribution: "Found by @sarah" with tier badge

**Why it matters:** Transforms the map from a directory into a social signal. Reduces the activation energy of going to something alone.

### 3. Discovery Feed (Social Layer)

Currently, `DiscoveryIndicator` shows ephemeral toasts. Upgrade to a persistent, social feed.

**Feed items:**

- "12 people discovered events in [your neighborhood] today"
- "[Name] found a free yoga class 3 blocks from you"
- "A new event just appeared on your map" (with preview)
- "Trending in [area]: [event name] — 40 people going"
- Weekly digest: "This week in [neighborhood]: 8 new events discovered"

**Implementation:** New screen or section within search landing page. Pulls from `UserEventDiscovery` records, aggregated by geography and time.

**Why it matters:** This is the social glue. Makes the app feel alive even when you're not scanning. Shows you that your community is active.

### 4. "Going With" / Crew Feature

The hardest part of going to an event alone is being alone.

**MVP:**

- "Going with [name]" on RSVP
- Invite a friend via share link (even if they don't have the app)
- Small group formation around events
- "David + 2 others are going" visible on event card

**Later:**

- Recurring crews ("Saturday morning farmers market crew")
- Open invites ("Looking for someone to go with")

**Why it matters:** Directly attacks the loneliness problem. Lowers the barrier from "I'll go alone" to "We're going together."

### 5. Shareable Event Web Pages

Currently no public web experience. Every event should have a clean, shareable URL.

**The page:**

- Event info, map, date/time
- "X people going" social proof
- "Scan flyers near you" app download CTA
- Open Graph tags for rich previews on iMessage, Instagram, etc.

**Why it matters:** This is the organic growth loop. Someone shares an event → friend sees it → downloads app → starts scanning. Without this, growth is entirely dependent on app store discovery.

### 6. Neighborhood Pulse

Replace the search landing page with curated local discovery.

**Sections:**

- "Tonight" — events happening in the next few hours
- "This Weekend" — upcoming weekend events
- "Trending Nearby" — fastest-growing events by engagement
- "Just Discovered" — most recently scanned events near you
- "Your Neighborhood This Week" — digest view

**Replace the date range calendar with three buttons:** Tonight / This Weekend / This Week. That's how people actually think about plans.

**Why it matters:** People don't want to search for things to do. They want to open the app and be told what's good nearby. Reduce cognitive load.

### 7. Lightweight Event Reactions (Not Comments)

Full comment systems kill small communities. Quick reactions preserve signal.

**Vibe tags (tap to add):**

- "Hidden gem"
- "Bring friends"
- "Great for solo"
- "Cash only"
- "Outdoor"
- "Kid-friendly"
- "Loud"
- "Chill"

**Why it matters:** Adds user-generated context without the toxicity of open comments. Helps people decide if an event is "for them."

---

## What to Simplify / Cut

| Feature                                                   | Action                                             | Reason                                               |
| --------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------- |
| Date range calendar picker                                | Replace with Tonight / Weekend / This Week buttons | Over-engineered for how people plan                  |
| Admin dashboard analytics (12-week trends, busiest times) | Deprioritize                                       | Premature optimization; focus on consumer experience |
| "Discovered" vs "My Events" tabs in Saved                 | Merge into single saved list                       | Confusing distinction for users                      |
| Private events                                            | Remove or hide                                     | Adds complexity, unclear use case at this stage      |
| Map style selector (3 options)                            | Keep but move deeper in settings                   | Not a core interaction                               |

---

## The Flywheel

```
Scan a flyer
    → Event appears on the map
        → Nearby users see it (social proof)
            → People RSVP / go together
                → They discover more flyers IRL
                    → They scan more flyers
                        → (repeat)
```

Right now we have steps 1-2. Steps 3-6 are the retention and growth loops that need to be built.

---

## Technical Notes

### What's Overbuilt (In a Good Way)

The real-time infrastructure (Redis pub/sub, RBush spatial indexing, per-user viewport filtering, WebSocket with zombie reaping, two-tier batching) can handle 100x current needs. The AI pipeline (vision extraction, embedding generation, duplicate detection, multi-event scanning) is production-grade. The bottleneck is product surface area, not technical capacity.

### What Needs Engineering Work

- **User entity:** Add XP, tier, streak fields
- **New entities:** Challenge, Reaction/VibeTags, Crew/Group
- **New service:** GamificationService (XP calculation, tier promotion, challenge tracking)
- **New service:** LeaderboardService (geo-scoped rankings)
- **Web app:** Event detail pages (public, shareable, SEO-friendly)
- **Push notifications:** Richer triggers (friend going, trending nearby, streak reminder)
- **Discovery feed:** Aggregation queries on UserEventDiscovery by geography + time

### Stack Strengths

- Bun runtime across all backend services (fast, consistent)
- TypeORM shared package means new entities propagate everywhere
- PostGIS + pgvector already in place for spatial + semantic queries
- Redis pub/sub architecture makes adding new real-time channels trivial
- Expo + React Native for cross-platform mobile with native feel

---

## Identity

**Not** an event platform. **Not** a calendar. **Not** Eventbrite for neighborhoods.

**A local discovery tool powered by its community of scanners.**

The people who scan flyers are the product. The events are the content. The map is the interface. The social proof is the engine. The third space is the outcome.

_"A Third Space in Your Pocket."_
