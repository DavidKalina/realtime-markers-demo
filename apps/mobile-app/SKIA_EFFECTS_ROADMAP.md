# Skia Shader Effects Roadmap

Visual effects beyond Mapbox's built-in capabilities, using `@shopify/react-native-skia` to push the snow-globe diorama aesthetic further.

---

## 1. Screen-Space Vignette

**Effort:** Low | **Performance:** Negligible

A dark, soft vignette around the edges of the screen — like peering into the snow globe through curved glass.

**How:** Full-screen `<Canvas>` overlay with a single radial gradient shader. No geo awareness needed, renders once and stays put.

```
center glow (transparent) → edge darkening (semi-opaque) → corners (dark)
```

**Knobs:** Inner radius, falloff curve, edge opacity, tint color (match dark/light theme).

---

## 2. Ambient Particle Layer (The Snow Globe Effect)

**Effort:** Medium | **Performance:** Light (single draw call)

Tiny floating specs — dust motes, fireflies, pollen — drifting lazily across the screen. The signature snow-globe element.

**How:** Full-screen Skia `<Canvas>` overlay with an SkSL fragment shader. Each particle is a point defined by a sine wave with per-particle phase, speed, and alpha. No physics needed — pure math.

**The Nintendo trick:** Render two particle layers at slightly different drift speeds. Feed the Mapbox camera center as a uniform to offset each layer differently on pan. Instant parallax — particles feel like they're at different distances from the glass.

**Particle ideas by context:**
- Default: soft white dust motes
- Night (after 8pm local): warm firefly dots with slow alpha pulse
- During active itinerary: subtle golden sparks (adventure energy)
- District "rising" momentum: upward-drifting embers

**Target:** ~40-60 particles, all in one shader pass. No individual views.

---

## 3. Marker Glow Shader

**Effort:** Medium | **Performance:** Light (1-3 markers max)

A soft, breathing radial glow around the selected or nearest marker. Like touching the glass of the snow globe and the nearest object responds.

**How:** Wrap the selected `<MarkerView>` content in a small Skia `<Canvas>`. SkSL shader draws a radial glow that pulses via a `clock` uniform. Only applied to the focused marker — never all of them.

**States:**
- **Idle pulse:** Slow sine-wave alpha oscillation (period ~3s)
- **Tap response:** Quick expand + fade ring (200ms)
- **Completion burst:** Expanding ring that fades out (one-shot, 500ms)

---

## 4. District Momentum Aura

**Effort:** Medium | **Performance:** Light

Subtle visual treatment on the Voronoi zone edges that reflects district momentum — rising districts feel warm and alive, cooling ones feel still.

**How:** Skia overlay or per-zone treatment:
- **Rising:** Soft animated glow along the zone border — a slow-traveling highlight that orbits the perimeter (shader `clock` + border path)
- **Cooling:** Desaturated border, maybe a faint frost/static noise texture
- **Steady:** Neutral, no extra effect

Alternative (cheaper): Drive this through Mapbox `line-dasharray` animation on the existing `DistrictZonesLayer` borders — dashes that slowly march for rising zones.

---

## 5. Frosted Glass UI Panels

**Effort:** Low-Medium | **Performance:** Light

Replace standard `BlurView` on bottom sheets, cards, and chips with a Skia frosted glass shader — more control over the blur kernel, tint, and grain texture.

**How:** Skia `<Canvas>` with `BackdropBlur` filter + a subtle noise overlay for that frosted texture. Can add a faint refraction distortion (chromatic aberration at edges) for premium feel.

**Where to apply:**
- `ItineraryDialogBox`
- `CommunityItineraryPreviewCard`
- `DistrictChip`
- `AdventureHUD`

---

## 6. Exploration Fog of War

**Effort:** High | **Performance:** Medium

Unexplored districts covered in a swirling, semi-transparent fog that parts as you explore them. More atmospheric than just dimming the fill opacity.

**How:** Skia overlay with an SkSL noise shader (Perlin or simplex) that scrolls slowly. Mask it to unexplored Voronoi cells using the existing GeoJSON geometry projected to screen coords.

**The challenge:** Requires projecting geo coordinates to screen space on each frame, synced with the Mapbox camera. Could use `MapView.getPointInView()` but that's async and per-point. May need to batch or approximate.

**Simpler alternative:** Use Mapbox `fill-pattern` with a pre-rendered animated fog sprite sheet (2-3 frames cycling). Less dynamic but stays in the Mapbox pipeline.

---

## 7. Itinerary Trail Shader

**Effort:** Medium | **Performance:** Light

When viewing an active itinerary route, the path line gets a shader treatment — glowing energy traveling along the route like a pulse through a circuit.

**How:** Skia `<Path>` drawn over the route coordinates with an SkSL shader that moves a bright spot along the path using a `clock` uniform. The "energy" travels from the current stop to the next one.

**Fallback:** Mapbox `line-dasharray` with animated offset (marching ants / treasure map dotted trail). Less flashy but free and geo-correct.

---

## Recommended Build Order

| Priority | Effect | Why |
|----------|--------|-----|
| 1 | Vignette | 30 minutes of work, instant diorama feel |
| 2 | Ambient particles | Defines the snow-globe identity |
| 3 | Marker glow | Makes interaction feel magical |
| 4 | Frosted glass panels | Polishes every UI surface |
| 5 | Momentum aura | Brings districts to life |
| 6 | Itinerary trail | Enhances the active adventure |
| 7 | Fog of war | Highest effort, save for last |

---

## Performance Budget

The rule: **never drop below 60fps on an iPhone 12 (baseline device).**

- Skia shaders run on the GPU — a full-screen fragment shader with simple math (sine, noise) is trivial
- The danger is overdraw — multiple full-screen overlays compositing on top of each other on top of Mapbox
- Keep full-screen overlays to **2 max** (vignette + particles)
- MarkerView Skia canvases are native views — limit to **3 simultaneous** animated ones
- Profile with Xcode GPU debugger before shipping each effect
