import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User";

@Entity("filters")
export class Filter {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user?: User;

  @Column({ type: "varchar" })
  name!: string;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @Column({ type: "text", nullable: true })
  semanticQuery?: string; // Natural language query from user

  @Column({ type: "text", nullable: true })
  embedding?: string; // Vector embedding stored in pgvector format

  @Column({ type: "jsonb" })
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
