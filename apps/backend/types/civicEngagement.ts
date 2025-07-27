import { type Point } from "geojson";
import {
  CivicEngagementType,
  CivicEngagementStatus,
} from "@realtime-markers/database";
import type {
  CivicEngagementInput,
  CivicEngagementUpdate,
  CivicEngagementSearchFilters,
} from "@realtime-markers/database";

// Re-export shared types for backward compatibility
export type CreateCivicEngagementInput = CivicEngagementInput;
export type UpdateCivicEngagementInput = CivicEngagementUpdate;

export interface AdminUpdateCivicEngagementStatusInput {
  status: CivicEngagementStatus;
  adminNotes?: string;
  implementedAt?: Date;
}

// Re-export the shared search filters type
export type CivicEngagementFilters = CivicEngagementSearchFilters;

export interface CivicEngagementStats {
  total: number;
  byType: Record<CivicEngagementType, number>;
  byStatus: Record<CivicEngagementStatus, number>;
}
