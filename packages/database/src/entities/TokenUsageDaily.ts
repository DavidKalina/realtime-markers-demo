import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from "typeorm";

@Entity("token_usage_daily")
@Unique("uq_token_usage_daily_key", [
  "usageDate",
  "model",
  "operation",
  "scope",
])
export class TokenUsageDaily {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ type: "date", name: "usage_date" })
  usageDate!: string; // YYYY-MM-DD

  @Index()
  @Column({ type: "text" })
  model!: string; // e.g., gpt-4o, gpt-4o-mini

  @Index()
  @Column({ type: "text" })
  operation!: string; // e.g., chat, embeddings

  @Index()
  @Column({ type: "text" })
  scope!: string; // e.g., image_processing, privacy_validation, event_extraction

  @Column({ type: "integer", name: "prompt_tokens", default: 0 })
  promptTokens!: number;

  @Column({ type: "integer", name: "completion_tokens", default: 0 })
  completionTokens!: number;

  @Column({ type: "integer", name: "total_tokens", default: 0 })
  totalTokens!: number;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}

