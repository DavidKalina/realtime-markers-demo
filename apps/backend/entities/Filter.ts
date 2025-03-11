// This would be added to the backend service as src/entities/Filter.ts
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
  user!: User;

  @Column({ type: "varchar" })
  name!: string;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @Column({ type: "jsonb" })
  criteria!: {
    categories?: string[];
    dateRange?: {
      start?: string;
      end?: string;
    };
    status?: string[];
    keywords?: string[];
    tags?: string[];
  };

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
