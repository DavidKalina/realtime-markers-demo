// entities/Group.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinTable,
  JoinColumn,
  Index,
} from "typeorm";
import { type Point } from "geojson";
import { User } from "./User";
import { Category } from "./Category";
import { Event } from "./Event";
import { GroupMembership } from "./GroupMembership"; // We'll define this next

export enum GroupVisibility {
  PUBLIC = "PUBLIC", // Anyone can see and join (or request to join)
  PRIVATE = "PRIVATE", // Only members can see, requires invite or approval to join
  // UNLISTED = "UNLISTED", // Discoverable by direct link only, anyone with link can join (optional)
}

@Entity("groups")
export class Group {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 100, unique: true })
  name!: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "varchar", nullable: true })
  emoji?: string; // Similar to Event.emoji

  @Column({ type: "varchar", name: "banner_image_url", nullable: true })
  bannerImageUrl?: string;

  @Column({ type: "varchar", name: "avatar_image_url", nullable: true })
  avatarImageUrl?: string;

  @Column({
    type: "enum",
    enum: GroupVisibility,
    default: GroupVisibility.PUBLIC,
  })
  visibility!: GroupVisibility;

  @Column({ name: "owner_id", type: "uuid" })
  ownerId!: string;

  @ManyToOne(() => User, (user) => user.ownedGroups, { onDelete: "SET NULL" }) // If owner is deleted, group might be orphaned or reassigned
  @JoinColumn({ name: "owner_id" })
  owner!: User;

  // Location for the group (e.g., a city or general area they operate in)
  @Column({
    type: "geometry",
    spatialFeatureType: "Point",
    srid: 4326,
    nullable: true,
  })
  location?: Point;

  @Column({ type: "text", nullable: true })
  address?: string; // Human-readable address for the group's general location

  // Headquarters information
  @Column({ name: "headquarters_place_id", type: "varchar", nullable: true })
  headquartersPlaceId?: string;

  @Column({ name: "headquarters_name", type: "varchar", nullable: true })
  headquartersName?: string;

  @Column({ name: "headquarters_address", type: "text", nullable: true })
  headquartersAddress?: string;

  @Column({
    name: "headquarters_location",
    type: "geometry",
    spatialFeatureType: "Point",
    srid: 4326,
    nullable: true,
  })
  headquartersLocation?: Point;

  @Column({ name: "member_count", type: "integer", default: 1 }) // Starts with owner
  memberCount!: number;

  @Column({
    name: "allow_member_event_creation",
    type: "boolean",
    default: false,
  })
  allowMemberEventCreation!: boolean; // Can regular members create events for this group?

  // Relationships
  @OneToMany(() => GroupMembership, (membership) => membership.group)
  memberships!: GroupMembership[];

  @OneToMany(() => Event, (event) => event.group)
  events!: Event[];

  @ManyToMany(() => Category, (category) => category.groups)
  @JoinTable({
    name: "group_categories",
    joinColumn: { name: "group_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "category_id", referencedColumnName: "id" },
  })
  categories!: Category[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
