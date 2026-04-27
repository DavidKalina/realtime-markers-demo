/**
 * TraceCollector — captures the prescription pipeline as a sequence of
 * structured events for the dev-only trace viewer.
 *
 * One TraceContext per prescription. The pipeline calls `emit(stage, ...)` at
 * each agent / policy / tool boundary; the collector batches inserts to keep
 * the hot path cheap.
 *
 * Failures inside the collector never bubble — instrumentation must not break
 * the prescription. We log and move on.
 */
import type { DataSource } from "typeorm";
import { PrescriptionTrace } from "../entities/PrescriptionTrace";
import { TraceEvent } from "../entities/TraceEvent";

export type TraceStage =
  // Top-level
  | "context.builder"
  // Strategist + policies
  | "strategist"
  | "distance_policy"
  | "opportunity_zones"
  | "willingness"
  | "search_envelope"
  | "opportunity_zone_policy"
  | "container_opportunity_policy"
  | "milestone_policy"
  // Scout
  | "scout.run"
  | "scout.search_places"
  | "scout.search_trails"
  | "scout.web_search"
  | "scout.submit_candidates"
  // Validator + ranker
  | "quality_match"
  | "validator.attempt"
  | "candidate_ranker"
  // Verification (live web research on winner)
  | "venue_verification"
  // Writer
  | "writer";

export interface TraceContextSummary {
  venueName?: string;
  venueCategory?: string;
  distanceFromHome?: number;
  capacityTrack?: string;
  repIntent?: string;
  homeBaseViability?: string;
  recommendedCity?: string;
  effectiveReachMode?: string;
  sidequestId?: string;
  llmCostUsd?: number;
}

export interface TraceContext {
  readonly id: string;
  emit(
    stage: TraceStage,
    payload: {
      input?: unknown;
      output?: unknown;
      meta?: unknown;
      durationMs?: number;
      status?: "success" | "error";
    },
  ): Promise<void>;
  /** Update top-level summary fields surfaced in the trace list view. */
  setSummary(patch: TraceContextSummary): void;
  finish(status: "success" | "failure", error?: Error): Promise<void>;
}

class NoopTraceContext implements TraceContext {
  readonly id = "noop";
  async emit(): Promise<void> {}
  setSummary(): void {}
  async finish(): Promise<void> {}
}

export const NOOP_TRACE: TraceContext = new NoopTraceContext();

class TraceContextImpl implements TraceContext {
  readonly id: string;
  private dataSource: DataSource;
  private sequence = 0;
  private startedAt = Date.now();
  private summary: TraceContextSummary = {};
  private active = true;

  constructor(deps: { dataSource: DataSource; id: string }) {
    this.dataSource = deps.dataSource;
    this.id = deps.id;
  }

  async emit(
    stage: TraceStage,
    payload: {
      input?: unknown;
      output?: unknown;
      meta?: unknown;
      durationMs?: number;
      status?: "success" | "error";
    },
  ): Promise<void> {
    if (!this.active) return;
    const seq = this.sequence++;
    try {
      await this.dataSource.getRepository(TraceEvent).insert({
        traceId: this.id,
        sequence: seq,
        stage,
        status: payload.status ?? "success",
        durationMs: payload.durationMs ?? null,
        input: redact(payload.input) as never,
        output: redact(payload.output) as never,
        meta: redact(payload.meta) as never,
      });
    } catch (err) {
      console.error(`[trace] emit failed (stage=${stage}, seq=${seq}):`, err);
    }
  }

  setSummary(patch: TraceContextSummary): void {
    this.summary = { ...this.summary, ...patch };
  }

  async finish(status: "success" | "failure", error?: Error): Promise<void> {
    if (!this.active) return;
    this.active = false;
    const durationMs = Date.now() - this.startedAt;
    try {
      await this.dataSource.getRepository(PrescriptionTrace).update(this.id, {
        status,
        errorMessage: error?.message ?? null,
        venueName: this.summary.venueName ?? null,
        venueCategory: this.summary.venueCategory ?? null,
        distanceFromHome: this.summary.distanceFromHome ?? null,
        capacityTrack: this.summary.capacityTrack ?? null,
        repIntent: this.summary.repIntent ?? null,
        homeBaseViability: this.summary.homeBaseViability ?? null,
        recommendedCity: this.summary.recommendedCity ?? null,
        effectiveReachMode: this.summary.effectiveReachMode ?? null,
        sidequestId: this.summary.sidequestId ?? null,
        completedAt: new Date(),
        durationMs,
        totalEvents: this.sequence,
        totalLlmCostUsd: this.summary.llmCostUsd ?? 0,
      });
    } catch (err) {
      console.error(`[trace] finish failed (id=${this.id}):`, err);
    }
  }
}

export class TraceCollector {
  private dataSource: DataSource;

  constructor(deps: { dataSource: DataSource }) {
    this.dataSource = deps.dataSource;
  }

  async start(input: {
    userId: string;
    questIndex?: number | null;
  }): Promise<TraceContext> {
    try {
      const trace = await this.dataSource
        .getRepository(PrescriptionTrace)
        .save({
          userId: input.userId,
          questIndex: input.questIndex ?? null,
          status: "in_progress",
        });
      return new TraceContextImpl({ dataSource: this.dataSource, id: trace.id });
    } catch (err) {
      console.error("[trace] start failed:", err);
      return NOOP_TRACE;
    }
  }
}

/**
 * Strip out anything that's an obvious prompt-cache hit (giant repeating
 * strings) and trim huge values. Trace events are dev-only but they go in
 * Postgres jsonb and a 200KB system prompt × every quest gets expensive fast.
 */
function redact(value: unknown): unknown {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value, (_key, val) => trimValue(val)));
}

const MAX_STRING = 8000;
function trimValue(val: unknown): unknown {
  if (typeof val === "string" && val.length > MAX_STRING) {
    return `${val.slice(0, MAX_STRING)}…[truncated ${val.length - MAX_STRING} chars]`;
  }
  return val;
}
