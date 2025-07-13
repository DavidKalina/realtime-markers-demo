// database/enums.ts
// Enums extracted from database entities for use across the application

export enum CivicEngagementType {
  POSITIVE_FEEDBACK = "POSITIVE_FEEDBACK",
  NEGATIVE_FEEDBACK = "NEGATIVE_FEEDBACK",
  IDEA = "IDEA",
}

export enum CivicEngagementStatus {
  PENDING = "PENDING",
  IN_REVIEW = "IN_REVIEW",
  IMPLEMENTED = "IMPLEMENTED",
  CLOSED = "CLOSED",
}

// Add other enums from database entities as needed
// For example, if Event has enums, they would go here too
