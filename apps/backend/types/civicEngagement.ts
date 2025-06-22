import { type Point } from "geojson";
import {
  CivicEngagementType,
  CivicEngagementStatus,
} from "../entities/CivicEngagement";

export interface CreateCivicEngagementInput {
  title: string;
  description?: string;
  type: CivicEngagementType;
  location?: Point;
  address?: string;
  locationNotes?: string;
  imageUrls?: string[];
  creatorId: string;
}

export interface UpdateCivicEngagementInput {
  title?: string;
  description?: string;
  status?: CivicEngagementStatus;
  adminNotes?: string;
  imageUrls?: string[];
}

export interface CivicEngagementFilters {
  type?: CivicEngagementType[];
  status?: CivicEngagementStatus[];
  creatorId?: string;
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  location?: {
    latitude: number;
    longitude: number;
    radius: number; // in meters
  };
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CivicEngagementStats {
  total: number;
  byType: Record<CivicEngagementType, number>;
  byStatus: Record<CivicEngagementStatus, number>;
}
