/**
 * Dev-only prescription tracer.
 *
 * Mounted at /dev (no auth). Local-only — do not expose in production.
 *
 * - GET /dev/             — HTML page
 * - GET /dev/traces       — list of recent prescription traces
 * - GET /dev/traces/:id   — full event timeline for one trace
 */
import { Hono } from "hono";
import type { AppContext } from "../types/context";
import type { DataSource } from "typeorm";
import { PrescriptionTrace } from "../entities/PrescriptionTrace";
import { TraceEvent } from "../entities/TraceEvent";

export const devTracerRouter = new Hono<AppContext>();

devTracerRouter.get("/traces", async (c) => {
  const dataSource = c.get("dataSource") as DataSource;
  const limit = Math.min(Number(c.req.query("limit") ?? 100), 500);
  const traces = await dataSource
    .getRepository(PrescriptionTrace)
    .createQueryBuilder("t")
    .orderBy("t.startedAt", "DESC")
    .limit(limit)
    .getMany();
  return c.json({ traces });
});

devTracerRouter.get("/traces/:id", async (c) => {
  const dataSource = c.get("dataSource") as DataSource;
  const id = c.req.param("id");
  const trace = await dataSource
    .getRepository(PrescriptionTrace)
    .findOne({ where: { id } });
  if (!trace) return c.json({ error: "not_found" }, 404);
  const events = await dataSource
    .getRepository(TraceEvent)
    .createQueryBuilder("e")
    .where("e.traceId = :id", { id })
    .orderBy("e.sequence", "ASC")
    .getMany();
  return c.json({ trace, events });
});

devTracerRouter.get("/", (c) => c.html(TRACER_HTML));

const TRACER_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Prescription Tracer</title>
<style>
  :root {
    --bg: #0d1117; --panel: #161b22; --border: #30363d;
    --fg: #e6edf3; --muted: #8b949e; --accent: #58a6ff;
    --green: #3fb950; --red: #f85149; --yellow: #d29922; --purple: #bc8cff;
    --orange: #db6d28; --teal: #39c5cf;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg);
    font: 13px/1.45 ui-monospace, "SF Mono", Menlo, monospace; }
  header { padding: 12px 18px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 16px; background: var(--panel); }
  header h1 { margin: 0; font-size: 14px; font-weight: 600; }
  header .pipeline { color: var(--muted); font-size: 12px; }
  header .pipeline code { background: #21262d; padding: 1px 6px; border-radius: 3px; }
  main { display: grid; grid-template-columns: 380px 1fr; height: calc(100vh - 47px); }
  .list { border-right: 1px solid var(--border); overflow-y: auto; }
  .list .row { padding: 10px 14px; border-bottom: 1px solid var(--border); cursor: pointer; }
  .list .row:hover { background: #1a2129; }
  .list .row.active { background: #1f2a3a; border-left: 3px solid var(--accent); padding-left: 11px; }
  .list .row .top { display: flex; justify-content: space-between; }
  .list .row .venue { font-weight: 600; }
  .list .row .when { color: var(--muted); font-size: 11px; }
  .list .row .meta { color: var(--muted); font-size: 11px; margin-top: 3px; }
  .list .row .pill { display: inline-block; padding: 1px 6px; border-radius: 3px;
    font-size: 10px; margin-right: 4px; }
  .pill.weak { background: #4d1f1f; color: #ffb4b4; }
  .pill.limited { background: #4d3a1f; color: #ffd699; }
  .pill.strong { background: #1f4d2a; color: #b4ffb4; }
  .pill.success { background: #1f4d2a; color: #b4ffb4; }
  .pill.failure { background: #4d1f1f; color: #ffb4b4; }
  .pill.in_progress { background: #1f3a4d; color: #a4d4ff; }
  .pill.auto { background: #4d2a4d; color: #ffaaff; }

  .detail { overflow-y: auto; padding: 0; }
  .detail .empty { color: var(--muted); padding: 60px; text-align: center; }
  .detail .summary { padding: 16px 20px; border-bottom: 1px solid var(--border);
    background: #11161e; }
  .detail .summary h2 { margin: 0 0 8px; font-size: 14px; }
  .detail .summary .field { display: inline-block; margin-right: 20px; color: var(--muted); }
  .detail .summary .field strong { color: var(--fg); }
  .timeline { padding: 16px 20px; }
  .event { border: 1px solid var(--border); border-radius: 6px; margin-bottom: 8px;
    background: var(--panel); }
  .event .head { padding: 8px 12px; cursor: pointer; display: flex; gap: 10px;
    align-items: center; }
  .event .head:hover { background: #1a2129; }
  .event .seq { color: var(--muted); width: 28px; text-align: right; flex-shrink: 0; }
  .event .stage-tag { font-weight: 600; padding: 1px 8px; border-radius: 3px; flex-shrink: 0; }
  .event .stage-desc { color: var(--muted); font-size: 12px; flex-grow: 1; }
  .event .duration { color: var(--muted); font-size: 11px; flex-shrink: 0; }
  .event .body { display: none; padding: 12px 14px 14px; border-top: 1px solid var(--border); }
  .event.open .body { display: block; }
  .event .section-title { color: var(--muted); font-size: 11px; text-transform: uppercase;
    margin: 4px 0 4px; letter-spacing: 0.04em; }
  .event pre { background: #0a0e14; border: 1px solid var(--border); border-radius: 4px;
    padding: 10px; margin: 0 0 10px; overflow-x: auto; max-height: 380px;
    font-size: 12px; white-space: pre-wrap; word-break: break-word; }
  .stage-strategist { background: #1f3a5d; color: #a4d4ff; }
  .stage-distance_policy { background: #2a3a5d; color: #c4d4ff; }
  .stage-opportunity_zones, .stage-opportunity_zone_policy { background: #4d2a4d; color: #ffaaff; }
  .stage-willingness { background: #2a4d4d; color: #aaffff; }
  .stage-search_envelope { background: #5d3a1f; color: #ffd0a4; }
  .stage-context_builder { background: #3a3a3a; color: #c4c4c4; }
  .stage-scout_run, .stage-scout_search_places, .stage-scout_search_trails,
  .stage-scout_web_search, .stage-scout_submit_candidates { background: #1f5d3a; color: #a4ffc4; }
  .stage-validator_attempt { background: #5d4a1f; color: #ffe4a4; }
  .stage-candidate_ranker { background: #5d3a3a; color: #ffc4c4; }
  .stage-writer { background: #4d1f5d; color: #d4a4ff; }
  .stage-milestone_policy, .stage-container_opportunity_policy { background: #5d5d1f; color: #ffffa4; }
  button.refresh { background: var(--panel); border: 1px solid var(--border);
    color: var(--fg); padding: 4px 10px; border-radius: 4px; cursor: pointer;
    margin-left: auto; font: inherit; }
  button.refresh:hover { background: #1a2129; }
</style>
</head>
<body>
<header>
  <h1>Prescription Tracer</h1>
  <span class="pipeline">
    <code>context</code> →
    <code>strategist</code> →
    <code>distance_policy</code> →
    <code>opportunity_zones</code> →
    <code>search_envelope</code> →
    <code>scout</code> →
    <code>validator</code> →
    <code>writer</code>
  </span>
  <button class="refresh" onclick="loadList()">Refresh</button>
</header>
<main>
  <div class="list" id="list"></div>
  <div class="detail" id="detail">
    <div class="empty">Select a trace from the left.</div>
  </div>
</main>
<script>
const STAGE_DESCRIPTIONS = {
  "context.builder": "Snapshot of inputs the strategist will see (history, radius, goal tags, recent diversity)",
  "willingness": "Observed willingness — how far the user has actually traveled in the past",
  "opportunity_zones": "Population/density analysis of home + nearby cities for this goal",
  "strategist": "LLM picks capacity track + venue category + target city + max distance",
  "distance_policy": "Hard rules for how far the quest may travel (early calibration, rejection clamps, regional floor)",
  "opportunity_zone_policy": "Adjusts strategy brief when a stronger nearby zone exists",
  "milestone_policy": "Goal-milestone gating — when to push for goal-closure rep vs broaden",
  "container_opportunity_policy": "Container-type guidance (structured class vs casual third place)",
  "search_envelope": "Final search radius + reach mode + preferred zone hints fed to the Scout",
  "scout.run": "Scout agent loop — picks search tools, accumulates candidates",
  "scout.search_places": "Google Places query for stable venues",
  "scout.search_trails": "OpenStreetMap query for trails / parks / paths",
  "scout.web_search": "Web search for events / classes / meetups",
  "scout.submit_candidates": "Scout finalizes its ranked candidate list",
  "quality_match": "LLM classifies each candidate's qualities against the brief's must/prefer/avoid profile, drops hard-avoid hits",
  "validator.attempt": "Code-level validator runs over Scout candidates, picks winner or returns rejection codes",
  "venue_verification": "LLM does live web_search on the chosen winner — fact-checks pricing, hours, ambiance, upcoming events. Verdict: approve / reject / uncertain.",
  "candidate_ranker": "Tie-break ranking with home-base bias and zone hints",
  "writer": "LLM writes the actual quest copy (title, description, hook, market reflection)"
};

const fmt = (ms) => ms == null ? "—" : ms < 1000 ? ms+"ms" : (ms/1000).toFixed(1)+"s";
const tsRel = (s) => {
  const d = (Date.now() - new Date(s).getTime()) / 1000;
  if (d < 60) return Math.floor(d)+"s ago";
  if (d < 3600) return Math.floor(d/60)+"m ago";
  if (d < 86400) return Math.floor(d/3600)+"h ago";
  return Math.floor(d/86400)+"d ago";
};

let activeId = null;

async function loadList() {
  const res = await fetch("/dev/traces");
  const data = await res.json();
  const list = document.getElementById("list");
  list.innerHTML = "";
  for (const t of data.traces) {
    const row = document.createElement("div");
    row.className = "row" + (t.id === activeId ? " active" : "");
    row.onclick = () => loadTrace(t.id);
    const venue = t.venueName ?? (t.status === "in_progress" ? "(in progress)" : "(no venue)");
    const dist = t.distanceFromHome != null ? Number(t.distanceFromHome).toFixed(1)+"mi" : "?";
    const cat = t.venueCategory ?? "—";
    const viab = t.homeBaseViability ?? "?";
    const reach = t.effectiveReachMode ?? "?";
    row.innerHTML = \`
      <div class="top">
        <span class="venue">\${esc(venue)}</span>
        <span class="when">\${tsRel(t.startedAt)}</span>
      </div>
      <div class="meta">
        <span class="pill \${t.status}">\${t.status}</span>
        <span>\${esc(cat)}</span> · <span>\${dist}</span>
      </div>
      <div class="meta">
        <span class="pill \${viab}">home: \${viab}</span>
        <span class="pill auto">reach: \${reach}</span>
        \${t.recommendedCity ? \`→ \${esc(t.recommendedCity)}\` : ""}
      </div>
    \`;
    list.appendChild(row);
  }
}

async function loadTrace(id) {
  activeId = id;
  document.querySelectorAll(".list .row").forEach(r => r.classList.remove("active"));
  const res = await fetch("/dev/traces/" + id);
  const data = await res.json();
  if (!data.trace) {
    document.getElementById("detail").innerHTML = "<div class='empty'>Trace not found.</div>";
    return;
  }
  renderDetail(data.trace, data.events);
  loadList();
}

function renderDetail(trace, events) {
  const detail = document.getElementById("detail");
  const dist = trace.distanceFromHome != null ? Number(trace.distanceFromHome).toFixed(2)+"mi" : "—";
  const dur = fmt(trace.durationMs);
  const summary = \`
    <div class="summary">
      <h2>\${esc(trace.venueName ?? "(no venue)")}\${trace.venueCategory ? " — " + esc(trace.venueCategory) : ""}</h2>
      <div>
        <span class="field"><strong>status:</strong> <span class="pill \${trace.status}">\${trace.status}</span></span>
        <span class="field"><strong>capacity:</strong> \${esc(trace.capacityTrack ?? "?")}</span>
        <span class="field"><strong>distance:</strong> \${dist}</span>
        <span class="field"><strong>duration:</strong> \${dur}</span>
        <span class="field"><strong>events:</strong> \${trace.totalEvents}</span>
      </div>
      <div style="margin-top:6px">
        <span class="field"><strong>home viability:</strong> <span class="pill \${trace.homeBaseViability ?? ''}">\${trace.homeBaseViability ?? '?'}</span></span>
        <span class="field"><strong>recommended:</strong> \${esc(trace.recommendedCity ?? "—")}</span>
        <span class="field"><strong>effective reach:</strong> <span class="pill auto">\${trace.effectiveReachMode ?? "?"}</span></span>
      </div>
      \${trace.repIntent ? \`<div style="margin-top:8px;color:var(--muted)"><strong style="color:var(--fg)">rep intent:</strong> \${esc(trace.repIntent)}</div>\` : ""}
      \${trace.errorMessage ? \`<div style="margin-top:8px;color:var(--red)"><strong>error:</strong> \${esc(trace.errorMessage)}</div>\` : ""}
    </div>
  \`;
  let timeline = '<div class="timeline">';
  for (const ev of events) {
    const stageClass = "stage-" + ev.stage.replace(/\\./g, "_");
    const desc = STAGE_DESCRIPTIONS[ev.stage] ?? "";
    timeline += \`
      <div class="event" data-id="\${ev.id}">
        <div class="head" onclick="this.parentElement.classList.toggle('open')">
          <span class="seq">#\${ev.sequence}</span>
          <span class="stage-tag \${stageClass}">\${ev.stage}</span>
          <span class="stage-desc">\${esc(desc)}</span>
          \${ev.status === "error" ? '<span class="pill failure">error</span>' : ""}
          <span class="duration">\${fmt(ev.durationMs)}</span>
        </div>
        <div class="body">
          \${ev.input ? \`<div class="section-title">input</div><pre>\${esc(JSON.stringify(ev.input, null, 2))}</pre>\` : ""}
          \${ev.output ? \`<div class="section-title">output</div><pre>\${esc(JSON.stringify(ev.output, null, 2))}</pre>\` : ""}
          \${ev.meta ? \`<div class="section-title">meta</div><pre>\${esc(JSON.stringify(ev.meta, null, 2))}</pre>\` : ""}
        </div>
      </div>
    \`;
  }
  timeline += "</div>";
  detail.innerHTML = summary + timeline;
}

function esc(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, ch => (
    {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]
  ));
}

loadList();
setInterval(loadList, 5000);
</script>
</body>
</html>`;
