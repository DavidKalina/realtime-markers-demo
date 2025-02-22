// entities/ProcessingQueue.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export enum QueueStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

@Entity("processing_queue")
export class ProcessingQueue {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "flyer_id", type: "uuid" })
  flyerId!: string;

  @Column({ type: "integer", default: 0 })
  priority!: number;

  @Column({ type: "integer", default: 0 })
  attempts!: number;

  @Column({ name: "last_attempt", type: "timestamptz", nullable: true })
  lastAttempt?: Date;

  @Column({
    type: "enum",
    enum: QueueStatus,
    default: QueueStatus.PENDING,
  })
  status!: QueueStatus;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
