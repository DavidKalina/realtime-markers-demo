import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity("llm_usage_logs")
export class LlmUsageLog {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ type: "varchar" })
  model!: string;

  @Column({ type: "varchar" })
  operation!: string;

  @Column({ type: "varchar" })
  caller!: string;

  @Column({ type: "integer", name: "prompt_tokens" })
  promptTokens!: number;

  @Column({ type: "integer", name: "completion_tokens" })
  completionTokens!: number;

  @Column({ type: "integer", name: "total_tokens" })
  totalTokens!: number;

  @Column({ type: "decimal", precision: 10, scale: 6, name: "estimated_cost" })
  estimatedCost!: number;

  @Column({ type: "integer", name: "duration_ms" })
  durationMs!: number;

  @Index()
  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;
}
