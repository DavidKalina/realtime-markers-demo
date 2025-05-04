import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { UserLevel } from "./UserLevel";

@Entity("levels")
export class Level {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "integer", unique: true, name: "level_number" })
  levelNumber!: number;

  @Column({ type: "varchar" })
  title!: string;

  @Column({ type: "integer", name: "required_xp" })
  requiredXp!: number;

  @Column({ type: "jsonb", nullable: true })
  rewards?: {
    type:
      | "SCAN_LIMIT_INCREASE"
      | "SPECIAL_BADGE"
      | "PREMIUM_FEATURE"
      | "CUSTOM_THEME"
      | "EMOJI_PACK";
    value: number | string;
  }[];

  @OneToMany(() => UserLevel, (userLevel) => userLevel.level)
  userLevels!: UserLevel[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
