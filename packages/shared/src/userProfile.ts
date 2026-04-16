/**
 * Public-facing user profile shape — shared between backend and mobile app.
 * This is the subset of user fields exposed over the API.
 * Kept in packages/shared so the mobile app doesn't need to depend on
 * packages/database (and its TypeORM/pg transitive deps).
 */
export interface UserProfile {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
  role: string;
  isVerified: boolean;
  totalXp: number;
  currentTier: string;
  currentStreak: number;
  longestStreak: number;
  onboardingProfile?: {
    activities: string[];
    pace: string;
  };
  comfortProfile?: {
    comfortZone: string;
    barriers: string;
    goals: string;
    goalKey?: string;
    goalTags?: string[];
    primaryGoal?: string;
  };
  fearLadder?: {
    overallScore: number;
    dimensionScores: Record<string, number>;
    responses: Record<string, number>;
    scenarios?: { id: string; text: string; dimension: string }[];
    dimensions?: string[];
  };
  onboardingPhase: number;
  pacePreference?: string;
  comfortRadiusMiles?: number;
  homeLatitude?: number;
  homeLongitude?: number;
  aiFocus?: {
    summary: string;
    generatedAt: string;
  };
  socialSituation?: {
    ageRange: string;
    gender: string;
    timeInArea: string;
    currentSocialLife: string;
    lookingFor: string[];
    workSituation: string;
    livingSituation: string;
    dailyRoutine?: string;
    transportation?: string;
    budget?: string;
  };
}
