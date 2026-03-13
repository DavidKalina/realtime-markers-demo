# Touch Grass — Work Triage

Prioritized by **impact × feasibility**. Impact = how much it closes the discovery→planning→progress loop. Feasibility = effort given what's already built.

**Core product thesis:** "I have free time and no plan." The app solves planning paralysis, adds accountability, and builds a personal record of getting out. Not a social network. Not a content aggregator. A planning + accountability + personal log tool for people who want to get out more but default to staying home.

**Feature litmus test:** Does this feature help someone plan their free time, actually go, or feel good about having gone? If it turns the app into a browsing experience where people scroll without leaving the couch, it doesn't belong.

---

## Phase 1: Close the Loop — COMPLETE

All core game loop infrastructure is built and integrated.

- [x] **Reweight XP** — Scan = 25 XP, check-in = 50 XP, completion = 200 XP
- [x] **Adventure Streaks** — Weekly streaks on User entity, milestone XP bonuses, StreakBanner component
- [x] **Category Badges** — 11 badge definitions, BadgeService, UserBadge entity, BadgeGrid component
- [x] **Personal Adventure Score** — 5-factor weighted score, AdventureScoreService, AdventureScoreCard component
- [x] **Hide Social Features** — following.tsx deleted, follow buttons removed
- [x] **Progress Dashboard** — UserProfile integrates StreakBanner, BadgeGrid, AdventureScoreCard with staggered animations

---

## Phase 2: The Accountability Bridge

These features close the gap between "I made a plan" and "I actually did it." This is the #1 priority — the game loop exists, but the nudge that makes Saturday happen is missing.

### 1. Calendar Integration + Reminders

**Impact:** Very High | **Effort:** ~4 hours | **Risk:** Low

The single biggest missing piece. Right now there's a gap between planning an itinerary on Monday and doing it on Saturday. Life fills that gap and kills the plan. Calendar reminders are the bridge.

**What to build:**

- On itinerary creation/activation, prompt to add to device calendar (Expo Calendar API)
- Calendar event with itinerary name, first stop address, planned start time
- Push notification the evening before: "Your adventure starts tomorrow at 10am"
- Morning-of reminder: "First stop: [coffee shop name] — 15 minutes away"
- If no itinerary planned by Thursday: gentle nudge — "No plans this weekend yet. Want to set something up?"

**Why this matters:** The target user's failure mode is "Saturday 4pm, did nothing." This is the only feature that directly prevents that.

**Files to touch:** `apps/mobile-app/` (Expo Calendar integration), `apps/backend/services/PushNotificationService.ts` (scheduled notification templates), itinerary creation flow

---

### 2. Intention-Based Itinerary Generation

**Impact:** High | **Effort:** ~3 hours | **Risk:** None

Free time isn't generic. Sometimes you want to clear your head, sometimes you're restless, sometimes you're lonely. Adding an intention/vibe selector to itinerary creation makes the AI output dramatically more relevant — same venues and data sources, different lens.

**What to build:**

- Intention selector in itinerary creation dialog (before activity types):
  - **Recharge** — solo, nature, quiet cafes, morning hours
  - **Explore** — new neighborhoods, variety, discovery-weighted
  - **Socialize** — lively spots, communal seating, evening-friendly, breweries
  - **Move** — trails, outdoor activities, physical, longer routes
  - **Learn** — museums, bookstores, galleries, cultural venues
  - **Treat Yourself** — great food, scenic spots, nice coffee
- Intention shapes AI prompt: venue types, time-of-day preference, pacing, neighborhood selection
- Log intention per itinerary for progress insights: "In March, 60% of your adventures were Explore-type"
- Insight nudges: "You haven't done a Socialize outing in 3 weeks — want to try one this weekend?"

**Why this matters:** This is how the third-space philosophy lives in the app without becoming Meetup. "Socialize" intention routes users to places where being around people happens naturally — no social graph needed.

**Files to touch:** `apps/backend/services/ItineraryService.ts` (AI prompt context), itinerary creation UI, `Itinerary` entity (new `intention` column)

---

### 3. Map-Based Itinerary Builder (Anchor & Build)

**Impact:** Very High | **Effort:** ~5 hours | **Risk:** Medium (UX complexity)

The map is currently a passive display layer. With scanning deprioritized, it needs a new purpose. Turn it into the planning surface — long-press to drop an anchor, AI builds the itinerary around it. This lets users inject personal knowledge the AI would never suggest (your favorite disc golf spot, that taco truck only locals know, the park bench with the best view).

**The interaction:**

1. Long-press the map → pin drops → "Start a plan here" prompt with option to label it (e.g. "Disc Golf at Pier Park")
2. Optionally search Google Places → add a second anchor ("I want to end up here")
3. ItineraryDialogBox slides up, pre-filled with city from pin location, anchored stops shown as fixed constraints
4. User picks intention/vibe, duration, budget → "Build My Plan"
5. AI generates the itinerary _around_ the user's anchors — filling in complementary stops, connecting trails, handling timing
6. Result renders on the map with the route drawn between stops

**Why this matters:** The AI is great at planning but it doesn't know your spots. The user knows _one thing_ they want to do — the app handles the rest. This is the difference between a blank canvas (overwhelming) and "start here, we'll figure out the rest" (empowering). It also gives the map a clear action-oriented purpose now that scanning is no longer the focal point.

**What exists:** `ItineraryDialogBox` is fully built with city selection, date, duration, stops, budget, vibes, rituals, and "Surprise Me." Long-press gesture handling exists on the map (currently used for marker reveal in explore mode). Google Places search exists. Itinerary generation pipeline supports `startTime`/`endTime` params.

**What to build:**

- Long-press → anchor pin drop with optional label/name
- Google Places search overlay for adding named anchors
- Pass anchor locations + labels to itinerary generation as fixed constraints
- Backend: ItineraryService accepts `anchorStops` param — AI treats these as required stops and builds around them
- Map route visualization on generated result (polyline between stops)
- Smooth transition between map interaction and ItineraryDialogBox

**Files to touch:** `apps/mobile-app/app/index.tsx` (map interaction), `apps/mobile-app/components/Itinerary/ItineraryDialogBox.tsx` (anchor UI), `apps/backend/services/ItineraryService.ts` (anchor constraints in AI prompt)

---

### 5. Itinerary Completion Celebration

**Impact:** High | **Effort:** ~2 hours | **Risk:** None

When you complete an itinerary, the moment should feel significant. Right now it's a rating prompt. It should be a celebration screen — XP awarded, badges unlocked, streak updated, all in one satisfying moment.

**What exists:** Itinerary completion flow works (mark done → rate → comment). `XPNotificationOverlay` exists for pop-ups. Haptic feedback patterns throughout the app.

**What to build:**

- Completion summary screen: total XP earned, new badges unlocked (if any), streak status, adventure score change
- Confetti or particle animation (Expo-compatible)
- Sound effect (optional, haptic at minimum)
- "Share this adventure" CTA (uses existing share token)

---

### 6. Streak + Badge Push Notifications

**Impact:** Medium-High | **Effort:** ~2 hours | **Risk:** None

"Your 7-week streak is at risk — get out there this weekend!" and "You unlocked Trail Blazer!" These are the re-engagement hooks that bring people back.

**What exists:** Full Expo push notification pipeline. `PushNotificationService` sends to registered devices. Badge/streak events already publish to Redis from Phase 1 work.

**What to build:**

- Streak-at-risk notification: scheduled check (Sunday evening if no check-in this week)
- Badge unlock notification: triggered by `BadgeService` on unlock
- Milestone notification: "You've completed 10 itineraries!"
- Templates in `PushNotificationService`

---

## Phase 3: Make the Record Beautiful

These features transform the personal log from data into something you'd look back at and share. The "snow globe" — a beautiful artifact of your real-world effort.

### 7. Photo Memories at Check-Ins

**Impact:** High | **Effort:** ~3 hours | **Risk:** Low

Check-ins are currently timestamps. Attaching a photo at each stop turns completed itineraries into mini photo journals. "Here's my Saturday in Portland." This is what someone screenshots and sends to a friend.

**What to build:**

- Optional photo capture at check-in (camera or gallery, Expo ImagePicker)
- Photo stored via existing StorageService (DO Spaces)
- Display photo in itinerary completion view and completion history
- Photo grid on completed itinerary detail screen
- Completed itineraries with photos become shareable visual stories

**Why this matters:** The personal log needs to be something you actually look back at. Timestamps aren't that. Photos are.

**Files to touch:** `ItineraryCheckin` entity (new `photoUrl` column), check-in flow UI, completion detail screen

---

### 8. Year-in-Review / Monthly Recaps

**Impact:** High | **Effort:** ~4 hours | **Risk:** None

The "Spotify Wrapped" moment. "This month you visited 3 new neighborhoods, completed 4 itineraries, and broke your longest streak." Screenshot-worthy, shareable, personal.

**What to build:**

- Monthly recap screen (accessible from profile): itineraries completed, unique venues, categories explored, total distance, streak status, badges unlocked, adventure score trend
- Year-in-review (December or on-demand): full year stats, top categories, longest streak, most-visited neighborhood, total adventures
- Visual design: bold typography, animated counters, category breakdown chart (reuse DNA chart pattern)
- Share as image (screenshot-optimized layout)

**Why this matters:** This is the emotional payoff of the entire system. It makes the log feel alive and gives users a reason to show other people the app.

---

### 9. Monthly Activity Calendar

**Impact:** Medium | **Effort:** ~3 hours | **Risk:** None

GitHub-style contribution graph but for real-world check-ins. "Look how green November was." Powerful for the snow globe / diorama feel.

**What exists:** All check-in timestamps stored. Could query `ItineraryCheckin` grouped by date.

**What to build:**

- Backend: endpoint returning check-in counts per day for a month range
- Mobile: calendar heat map component (green intensity = number of check-ins)
- Place on user profile below adventure score

---

## Phase 4: Trail Intelligence

The trail system (Overpass API) is a genuine differentiator. Trails are public geographic infrastructure, not someone else's content — they don't expire, don't belong to a competing platform, and literally ARE touching grass. Currently underutilized.

### 10. Trail-Aware Itinerary Generation

**Impact:** High | **Effort:** ~3 hours | **Risk:** Low

When someone plans a Saturday morning, trails should be first-class connective tissue between stops — not just another stop type. "There's a 1.2-mile trail connecting the coffee shop to the bookstore — walk it instead of driving."

**What to build:**

- During itinerary generation, query Overpass for trails _between_ stops (not just as stops)
- AI prompt context: suggest walking routes via trails when distance < 2 miles
- Display trail segments in itinerary timeline as connective tissue (different visual from regular stops)
- Trail distance metadata shown in itinerary detail

**Why this matters:** Most itinerary apps give you a driving route between pins. This one gives you a walk through nature. That's a genuine differentiator.

**Files to touch:** `apps/backend/services/ItineraryService.ts`, `OverpassService.ts`, itinerary detail UI

---

### 11. Coffee + Trail Quick Template

**Impact:** Medium-High | **Effort:** ~1 hour | **Risk:** None

The atomic unit of the app's identity. Sunday morning: coffee shop + nearby trail. One button. Not buried in general itinerary creation.

**What to build:**

- Prominent shortcut in itinerary creation: "Coffee + Trail" preset
- Auto-selects: morning time, cafe category + trail/hiking, budget < $20, 2-3 hours
- Could expand to other templates: "Date Night," "Solo Recharge," "Weekend Explorer"
- Templates can be user-created from rituals

---

### 12. Contextual Trail Suggestions at Check-In

**Impact:** Medium | **Effort:** ~2 hours | **Risk:** Low

When someone checks in at a coffee shop, a subtle suggestion: "There's a 0.8-mile trail 3 minutes from here." Not a notification bombardment — a contextual nudge when they're already out.

**What to build:**

- On check-in, query Overpass for trails within ~1km of current location
- If found, show inline suggestion in check-in confirmation (not a push notification)
- "Extend your adventure: [Trail Name] is a 12-minute walk from here"
- Tapping the suggestion adds it as a bonus stop to the active itinerary

---

### 13. Trail Stats in Personal Log

**Impact:** Medium | **Effort:** ~1 hour | **Risk:** None

"You've walked 14 different trails across 3 cities this year." Distance is tangible in a way venue counts aren't — you physically covered ground.

**What to build:**

- Track trail check-ins separately (or tag by venue category)
- Aggregate trail distance from Overpass metadata (trail length)
- Display on profile: unique trails, total trail distance, cities with trails
- Badge tie-in: Trail Blazer badge already exists, could add distance milestones

---

## Phase 5: Growth & Social (When Ready)

Only after Phases 2-4 are solid. These features add distribution without compromising the personal nature of the app.

### 14. Shared Itineraries (Adopt & Co-Track)

**Impact:** Medium-High | **Effort:** ~5 hours | **Risk:** Medium (UX complexity)

Share an itinerary link → friend opens it → "Adopt this itinerary" → cloned into their account → both track check-ins independently. This is the only social feature worth building — it's the single organic growth channel.

**What exists:** Share tokens, public itinerary viewing, itinerary cloning (create from ritual pattern). Push notification pipeline for co-progress updates.

**What to build:**

- "Adopt" button on public itinerary view → clone itinerary + items into adopter's account
- Optional: link adopted itineraries so both users can see each other's check-in progress
- Deep link handling in Expo for share URLs

**Why this is the right social feature:** It solves the multiplayer version of planning paralysis — "my friend and I both want to do something but neither of us plans." One person plans, texts the link, the other adopts it. Cooperative, not competitive. No social graph required.

---

### 15. Ritual Streaks

**Impact:** Medium | **Effort:** ~2 hours | **Risk:** Low

"3rd Sunday coffee + trail in a row." Adding a streak counter for recurring rituals creates accountability for personal routines.

**What exists:** `ItineraryRitual` entity with `usageCount`, `lastUsedAt`.

**What to build:**

- Add to `ItineraryRitual`: `currentStreak` (int), `longestStreak` (int)
- On itinerary completion from ritual, increment ritual streak
- Display ritual streak on itinerary list + ritual detail
- "Your Sunday ritual is 4 weeks strong"

---

### 16. Unify Leaderboard Ranking

**Impact:** Low-Medium | **Effort:** ~1 hour | **Risk:** None

Leaderboards currently rank by `scan_count`. Should rank by adventure score or total XP. Reframe as "Top Adventurers" not "Top Scanners."

**Files to touch:** `apps/backend/services/LeaderboardService.ts`, Third Space Score contributor labels

---

## Parked

Ideas acknowledged but explicitly deferred.

| Idea                        | Why Parked                                                                       |
| --------------------------- | -------------------------------------------------------------------------------- |
| Volunteering API            | Aggregator trap — importing someone else's database makes you a worse middleman  |
| Competitive leaderboards    | Wrong motivator for target user (comparison kills the vibe for introverts)       |
| Social feed / following     | No value, stripped from UI; app is personal, not social                          |
| Ticketmaster import         | Events that already have a home on Ticketmaster — you add nothing by aggregating |
| Monetization / B2B          | Premature — product-market fit first                                             |
| National parks / places API | Scope creep — would need new content type infrastructure                         |
| Venue reviews / ratings     | Now you're Yelp — link out to Google Maps if someone wants reviews               |
| Chat / messaging            | You're not a messaging app — shared itineraries work via links                   |
| Universal pull-down search  | Nice to have, not strategic — revisit after core loop is proven                  |

---

## Suggested Execution Order

```
Phase 1: Close the Loop — DONE
  [x] Reweight XP
  [x] Adventure Streaks
  [x] Category Badges
  [x] Personal Adventure Score
  [x] Hide Social Features
  [x] Progress Dashboard

Phase 2: The Accountability Bridge (~16 hours)
  1. Calendar Integration + Reminders           (4 hours)  ← #1 PRIORITY
  2. Intention-Based Itinerary Generation       (3 hours)
  3. Map-Based Itinerary Builder (Anchor & Build) (5 hours)
  4. Itinerary Completion Celebration           (2 hours)
  5. Streak/Badge Push Notifications            (2 hours)

Phase 3: Make the Record Beautiful (~10 hours)
  7. Photo Memories at Check-Ins                (3 hours)
  8. Year-in-Review / Monthly Recaps            (4 hours)
  9. Monthly Activity Calendar                  (3 hours)

Phase 4: Trail Intelligence (~7 hours)
  10. Trail-Aware Itinerary Generation          (3 hours)
  11. Coffee + Trail Quick Template             (1 hour)
  12. Contextual Trail Suggestions              (2 hours)
  13. Trail Stats in Personal Log               (1 hour)

Phase 5: Growth & Social (when ready, ~8 hours)
  14. Shared Itineraries (Adopt & Co-Track)     (5 hours)
  15. Ritual Streaks                            (2 hours)
  16. Unify Leaderboard Ranking                 (1 hour)
```
