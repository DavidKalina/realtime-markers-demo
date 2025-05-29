// src/dtos/group.dto.ts (or define inline)
import { GroupMemberRole } from "../entities/GroupMembership"; // Assuming GroupMemberRole is in Group.ts or GroupMembership.ts
import type { GroupVisibility } from "../entities/Group";
import type { Point } from "geojson";

export interface HeadquartersInfo {
  placeId: string;
  name: string;
  address: string;
  coordinates: Point;
}

export interface CreateGroupDto {
  name: string;
  description?: string;
  emoji?: string;
  bannerImageUrl?: string;
  avatarImageUrl?: string;
  visibility?: GroupVisibility; // Default to PUBLIC if not provided
  location?: Point;
  address?: string;
  headquarters?: HeadquartersInfo;
  allowMemberEventCreation?: boolean;
  categoryIds?: string[];
  tags?: string[]; // Add tags field for user-provided tags
}

export interface UpdateGroupDto {
  name?: string;
  description?: string;
  emoji?: string;
  bannerImageUrl?: string;
  avatarImageUrl?: string;
  visibility?: GroupVisibility;
  location?: Point;
  address?: string;
  headquarters?: HeadquartersInfo;
  allowMemberEventCreation?: boolean;
  categoryIds?: string[]; // Allow updating categories
  tags?: string[]; // Allow updating tags
}

export interface UpdateMemberRoleDto {
  role: GroupMemberRole;
}
