# Product Direction: "A Third Space in Your Pocket"

> Your neighborhood is more alive than your phone makes it look.
> Point your camera at any flyer and make it real for everyone around you.

---

## Core Thesis

Third places — cafes, parks, community centers, open mics, pickup games — are disappearing from American life. The events still happen, but they're invisible: stapled to telephone poles, chalked on sandwich boards, pinned to coffee shop corkboards. This app digitizes the long tail of local culture and makes it discoverable, social, and alive.

The input is the physical world. The output is a living map of what's happening near you, powered by the people who actually go outside.

**The business model follows the value chain:** users scan for free (they're the engine), organizations pay for branded presence on the map they're already appearing on (they're the customer). Don't charge the people filling your map. Charge the people who benefit from the audience.

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

## Monetization Strategy

**Users are the engine. Organizations are the customer.**

The consumer paywall model (charging per scan, gating features behind a subscription) is wrong for this product. Every friction point on scanning throttles your own network effect. The map gets valuable because people scan freely. Organizations — universities, venues, BIDs, corporate campuses — pay because they want to be visible, branded, and measured on the map that users are already populating.

### Pricing Tiers

| Tier             | Price     | What You Get                                                                                                                                      |
| ---------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Community**    | Free      | Claim your org, basic profile, events appear on map via user scans                                                                                |
| **Verified Org** | ~$99/mo   | Verified badge, org page, event analytics (views, saves, RSVPs), custom category filters                                                          |
| **Featured**     | ~$299/mo  | Promoted placement in discovery feeds, branded map markers, push notification inclusion for nearby users, shareable event pages with org branding |
| **Enterprise**   | ~$499+/mo | API access, multi-location support, dedicated analytics dashboard, bulk event upload, co-branded campus/district map view                         |

### Why Not Consumer Paywall

- Scanning is the atomic unit of value creation — don't gate it
- Gamification (XP, tiers, streaks) only works if it's free to play
- Network effects require volume; paywalls kill volume
- Organizations already have marketing budgets; users don't have "scan flyer" budgets
- B2B revenue is more predictable (monthly contracts vs. app store impulse buys)

---

## Go-to-Market

### Target Segments

1. **Universities** — constant event churn (clubs, Greek life, guest speakers, intramurals), centralized campus, student body already on phones
2. **Venues** — bars, music halls, community centers that rely on foot traffic and flyer culture
3. **BIDs / City Districts** — Business Improvement Districts that aggregate local business events, farmers markets, street fairs
4. **Corporate Campuses** — internal events, wellness programs, lunch-and-learns — closed maps for employee engagement

### Pilot Strategy

One city. Ten organizations. Prove the content pipeline.

1. Seed 5-10 orgs (mix of university + venues + one BID)
2. Run a free 30-day pilot — org gets analytics dashboard access
3. Show them the data: "Your jazz night was seen by 340 people, 47 saved it, 12 RSVPd — here's the heat map of where they were"
4. Convert to paid tier based on which features they used most

### Sales Motion

Free pilot → show analytics → convert to paid. No cold outreach needed initially — orgs whose events are already being scanned by users get a "Claim your organization" prompt. Inbound-first.

---

## What to Build Next

### Phase 1: Organization Platform (Unlocks Revenue)

This is the monetization foundation. Nothing generates revenue until orgs can onboard, see value, and pay.

**Organization entity + onboarding flow:**

- New `Organization` entity (name, logo, description, verified status, subscription tier)
- Claim flow: org signs up via web dashboard, links to existing events already on the map
- Org profile page (web + mobile) showing all their events, bio, social links

**Branded event badges + custom org filters:**

- Events linked to a verified org show the org badge on the map marker
- Mobile filter: "Show me only [University Name] events" or "Show me Featured orgs"
- Org-specific category tagging (e.g., a venue can tag events as "21+", "free entry")

**Organization analytics dashboard:**

- Views, saves, RSVPs per event over time
- Heat map of where viewers are located
- Comparison across events ("Your open mic gets 3x more saves than your trivia night")
- Exportable reports (PDF/CSV)

**Shareable event web pages:**

- Every event gets a clean public URL with Open Graph tags
- Org-branded pages for verified organizations
- "X people going" social proof + app download CTA
- Rich previews on iMessage, Instagram, Twitter, Slack

**Stripe integration for org subscriptions:**

- Self-serve upgrade flow in web dashboard
- Monthly billing with tier-based feature gating
- Usage-based upsell triggers ("You've hit 50 events this month — upgrade for promoted placement")

### Phase 2: User Engagement Engine (Unlocks Retention)

Users scan for free, but they stay because it's fun. This phase builds the habit loops.

**Gamification system:**

Scanner Tiers:

- Explorer (0-10 scans) — just getting started
- Scout (11-50 scans) — knows the neighborhood
- Curator (51-200 scans) — trusted source
- Ambassador (200+) — community pillar

Mechanics:

- XP earned per scan, bonus for first-to-scan an event
- Weekly challenges ("Scan 3 flyers this week," "Discover an event in a new category")
- Streak tracking (consecutive days/weeks with a scan)
- Neighborhood leaderboards (top scanners in your area)
- Visual progression on profile (tier badge, XP bar)

Infrastructure ready: `User.scanCount`, `User.discoveryCount`, `User.weeklyScanCount` already exist. Needs: XP column, tier calculation, challenge system, leaderboard queries.

**Social proof on the map:**

On markers:

- Show RSVP/save count: `🎵 +23 going`
- Show friends going (when social graph exists): `🎵 3 friends saved`
- "Trending" indicator for events with rapid engagement growth

On event details:

- Avatars of people who RSVP'd (or count if no social graph yet)
- "X people discovered this today"
- Scanner attribution: "Found by @sarah" with tier badge

**Discovery feed (social layer):**

Upgrade `DiscoveryIndicator` from ephemeral toasts to a persistent, social feed.

Feed items:

- "12 people discovered events in [your neighborhood] today"
- "[Name] found a free yoga class 3 blocks from you"
- "A new event just appeared on your map" (with preview)
- "Trending in [area]: [event name] — 40 people going"
- Weekly digest: "This week in [neighborhood]: 8 new events discovered"

Implementation: New screen or section within search landing page. Pulls from `UserEventDiscovery` records, aggregated by geography and time.

### Phase 3: Social & Community (Unlocks Virality)

The features that turn individual users into groups and groups into community.

**"Going With" / Crew feature:**

MVP:

- "Going with [name]" on RSVP
- Invite a friend via share link (even if they don't have the app)
- Small group formation around events
- "David + 2 others are going" visible on event card

Later:

- Recurring crews ("Saturday morning farmers market crew")
- Open invites ("Looking for someone to go with")

**Neighborhood Pulse:**

Replace the search landing page with curated local discovery.

Sections:

- "Tonight" — events happening in the next few hours
- "This Weekend" — upcoming weekend events
- "Trending Nearby" — fastest-growing events by engagement
- "Just Discovered" — most recently scanned events near you
- "Your Neighborhood This Week" — digest view

Replace the date range calendar with three buttons: Tonight / This Weekend / This Week. That's how people actually think about plans.

**Lightweight event reactions / Vibe tags:**

Tap-to-add tags instead of comments (comments kill small communities):

- "Hidden gem"
- "Bring friends"
- "Great for solo"
- "Cash only"
- "Outdoor"
- "Kid-friendly"
- "Loud"
- "Chill"

---

## The Flywheel

```
Users scan flyers for free (XP incentive)
    → Map gets denser with events
        → More users download (map is useful)
            → Organizations see audience forming
                → Organizations pay for branded presence + filters
                    → Org events populate map (curated, high-quality)
                        → Map gets even more valuable
                            → (repeat)
```

The user side is the growth engine (free, gamified, social). The org side is the revenue engine (analytics, branding, promoted placement). Neither works without the other. Build the user side first (it's mostly built), then layer in the org platform.

---

## What to Simplify / Cut

| Feature                                                   | Action                                             | Reason                                                         |
| --------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------- |
| Consumer paywall / scan limits                            | Remove entirely                                    | Don't throttle your own network effect; revenue comes from B2B |
| Date range calendar picker                                | Replace with Tonight / Weekend / This Week buttons | Over-engineered for how people plan                            |
| Admin dashboard analytics (12-week trends, busiest times) | Repurpose for org-facing analytics                 | Same queries, different audience — make it a paid feature      |
| "Discovered" vs "My Events" tabs in Saved                 | Merge into single saved list                       | Confusing distinction for users                                |
| Private events                                            | Remove or hide                                     | Adds complexity, unclear use case at this stage                |
| Map style selector (3 options)                            | Keep but move deeper in settings                   | Not a core interaction                                         |

---

## Technical Notes

### What's Overbuilt (In a Good Way)

The real-time infrastructure (Redis pub/sub, RBush spatial indexing, per-user viewport filtering, WebSocket with zombie reaping, two-tier batching) can handle 100x current needs. The AI pipeline (vision extraction, embedding generation, duplicate detection, multi-event scanning) is production-grade. The bottleneck is product surface area, not technical capacity.

### What Needs Engineering Work

**Phase 1 (Org Platform):**

- **New entity:** `Organization` (name, logo, verified, tier, stripeCustomerId, stripeSubscriptionId)
- **New entity:** `OrganizationMembership` (userId, orgId, role)
- **Relation:** `Event.organizationId` — link events to claiming org
- **Web dashboard:** Org onboarding flow, org analytics pages, Stripe checkout integration
- **Mobile:** Org badge rendering on markers, org filter in category picker
- **Backend:** Stripe webhook handlers, subscription lifecycle management
- **New service:** `OrganizationService` (CRUD, claim flow, verification)
- **New service:** `OrgAnalyticsService` (views, saves, RSVPs aggregated per event/org)
- **Web app:** Public event detail pages (shareable, SEO-friendly, OG tags)

**Phase 2 (Engagement):**

- **User entity:** Add XP, tier, streak fields
- **New entities:** Challenge, Reaction/VibeTags
- **New service:** GamificationService (XP calculation, tier promotion, challenge tracking)
- **New service:** LeaderboardService (geo-scoped rankings)
- **Discovery feed:** Aggregation queries on UserEventDiscovery by geography + time
- **Push notifications:** Richer triggers (friend going, trending nearby, streak reminder)

**Phase 3 (Social):**

- **New entities:** Crew/Group, CrewMembership
- **New service:** CrewService (formation, invites, recurring groups)
- **Neighborhood Pulse:** Time-bucketed event queries, engagement velocity calculations

### Stack Strengths

- Bun runtime across all backend services (fast, consistent)
- TypeORM shared package means new entities propagate everywhere
- PostGIS + pgvector already in place for spatial + semantic queries
- Redis pub/sub architecture makes adding new real-time channels trivial
- Expo + React Native for cross-platform mobile with native feel
- Next.js web dashboard is ready to become the org-facing product

---

## Identity

**Not** an event platform. **Not** a calendar. **Not** Eventbrite for neighborhoods.

**A local discovery tool powered by its community of scanners — and funded by the organizations they make visible.**

Two sides, one map. Users scan because it's fun (XP, social, discovery). Organizations pay because the audience is already there (analytics, branding, reach). The map is the marketplace. The scan is the transaction. The third space is the outcome.

_"A Third Space in Your Pocket."_
