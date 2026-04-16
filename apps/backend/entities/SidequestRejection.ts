import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  type Relation,
} from "typeorm";
import { User } from "./User";
import { Sidequest } from "./Sidequest";

export enum RejectionReason {
  TOO_SOCIAL = "TOO_SOCIAL",
  TOO_FAR = "TOO_FAR",
  TOO_PUBLIC = "TOO_PUBLIC",
  TOO_MUCH_EFFORT = "TOO_MUCH_EFFORT",
  NOT_MY_VIBE = "NOT_MY_VIBE",
  BAD_TIMING = "BAD_TIMING",
  NEED_GENTLER = "NEED_GENTLER",
}

@Entity("sidequest_rejections")
export class SidequestRejection {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "sidequest_id", type: "uuid" })
  sidequestId!: string;

  @ManyToOne(() => Sidequest, { onDelete: "CASCADE" })
  @JoinColumn({ name: "sidequest_id" })
  sidequest!: Relation<Sidequest>;

  @Index()
  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: Relation<User>;

  @Column({
    type: "enum",
    enum: RejectionReason,
  })
  reason!: RejectionReason;

  @Column({ name: "venue_name", type: "varchar", length: 255, nullable: true })
  venueName?: string;

  @Column({ name: "venue_category", type: "varchar", length: 100, nullable: true })
  venueCategory?: string;

  @Column({ type: "text", nullable: true })
  note?: string;

  @Index()
  @CreateDateColumn({ name: "rejected_at", type: "timestamptz" })
  rejectedAt!: Date;
}
