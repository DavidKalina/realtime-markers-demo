import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from "typeorm";

export type TraceEventStatus = "success" | "error";

@Entity("trace_events")
@Index(["traceId", "sequence"])
export class TraceEvent {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id!: string;

  @Column({ name: "trace_id", type: "uuid" })
  traceId!: string;

  @Column({ type: "integer" })
  sequence!: number;

  @Column({ type: "varchar", length: 64 })
  stage!: string;

  @Column({ type: "varchar", length: 16, default: "success" })
  status!: TraceEventStatus;

  @Column({ name: "duration_ms", type: "integer", nullable: true })
  durationMs?: number | null;

  @Column({ type: "jsonb", nullable: true })
  input?: unknown;

  @Column({ type: "jsonb", nullable: true })
  output?: unknown;

  @Column({ type: "jsonb", nullable: true })
  meta?: unknown;

  @CreateDateColumn({ name: "emitted_at" })
  emittedAt!: Date;
}
