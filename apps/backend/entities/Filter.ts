import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./User";

@Entity("filters")
export class Filter {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ type: "uuid", name: "user_id" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user?: User;

  @Column({ type: "varchar", name: "name" })
  name!: string;

  @Index()
  @Column({ type: "boolean", default: true, name: "is_active" })
  isActive!: boolean;

  @Column({ type: "text", nullable: true, name: "semantic_query" })
  semanticQuery?: string; // Natural language query from user

  @Column({ type: "text", nullable: true, name: "embedding" })
  embedding?: string; // Vector embedding stored in pgvector format

  @Column({ type: "varchar", nullable: true, name: "emoji" })
  emoji?: string; // AI-generated emoji for the filter

  @Column({ type: "jsonb", name: "criteria" })
  criteria!: {
    dateRange?: {
      start?: string;
      end?: string;
    };
    status?: string[];
    location?: {
      latitude?: number;
      longitude?: number;
      radius?: number; // in meters
    };
  };

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
