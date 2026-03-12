import type { DataSource } from "typeorm";
import {
  UserBadge,
  ItineraryCheckin,
  ItineraryItem,
  Itinerary,
} from "@realtime-markers/database";
import type { GamificationService } from "./GamificationService";
import type { RedisService } from "./shared/RedisService";

// ── Badge definitions ──────────────────────────────────────────────────────
export interface BadgeDefinition {
  id: string;
  name: string;
  emoji: string;
  description: string;
  threshold: number;
  criteria: BadgeCriteria;
}

type BadgeCriteria =
  | { type: "category"; categories: string[] }
  | { type: "time"; direction: "after" | "before"; hour: number }
  | { type: "day"; days: number[] } // 0=Sun, 6=Sat
  | { type: "category_diversity"; count: number }
  | { type: "completions"; count: number }
  | { type: "streak"; weeks: number };

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "coffee_connoisseur",
    name: "Coffee Shop Connoisseur",
    emoji: "\u2615",
    description: "Check in at 10 cafes or coffee shops",
    threshold: 10,
    criteria: { type: "category", categories: ["cafe", "coffee_shop", "coffee", "bakery"] },
  },
  {
    id: "trail_blazer",
    name: "Trail Blazer",
    emoji: "\uD83E\uDD7E",
    description: "Check in at 5 trails or hiking spots",
    threshold: 5,
    criteria: { type: "category", categories: ["trail", "hiking", "park", "nature_reserve", "national_park"] },
  },
  {
    id: "night_owl",
    name: "Night Owl",
    emoji: "\uD83E\uDD89",
    description: "5 check-ins after 8pm",
    threshold: 5,
    criteria: { type: "time", direction: "after", hour: 20 },
  },
  {
    id: "culture_vulture",
    name: "Culture Vulture",
    emoji: "\uD83C\uDFA8",
    description: "5 museum or gallery check-ins",
    threshold: 5,
    criteria: { type: "category", categories: ["museum", "art_gallery", "gallery", "theater", "performing_arts"] },
  },
  {
    id: "foodie",
    name: "Foodie",
    emoji: "\uD83C\uDF7D\uFE0F",
    description: "10 restaurant check-ins",
    threshold: 10,
    criteria: { type: "category", categories: ["restaurant", "food", "dining", "brunch", "bar", "pub"] },
  },
  {
    id: "early_bird",
    name: "Early Bird",
    emoji: "\uD83C\uDF05",
    description: "5 check-ins before 10am",
    threshold: 5,
    criteria: { type: "time", direction: "before", hour: 10 },
  },
  {
    id: "weekend_warrior",
    name: "Weekend Warrior",
    emoji: "\u26A1",
    description: "10 weekend check-ins",
    threshold: 10,
    criteria: { type: "day", days: [0, 6] },
  },
  {
    id: "explorer",
    name: "Explorer",
    emoji: "\uD83E\uDDED",
    description: "Visit 5 different venue categories",
    threshold: 5,
    criteria: { type: "category_diversity", count: 5 },
  },
  {
    id: "diverse_palate",
    name: "Diverse Palate",
    emoji: "\uD83C\uDF08",
    description: "Visit 10 different venue categories",
    threshold: 10,
    criteria: { type: "category_diversity", count: 10 },
  },
  {
    id: "completionist",
    name: "Completionist",
    emoji: "\u2705",
    description: "Complete 5 full itineraries",
    threshold: 5,
    criteria: { type: "completions", count: 5 },
  },
  {
    id: "streak_master",
    name: "Streak Master",
    emoji: "\uD83D\uDD25",
    description: "Hit a 7-week adventure streak",
    threshold: 7,
    criteria: { type: "streak", weeks: 7 },
  },
];

// ── Service ────────────────────────────────────────────────────────────────

export interface BadgeServiceDeps {
  dataSource: DataSource;
  gamificationService: GamificationService;
  redisService: RedisService;
}

export interface UserBadgeWithDef {
  badgeId: string;
  name: string;
  emoji: string;
  description: string;
  threshold: number;
  progress: number;
  unlockedAt: Date | null;
}

export class BadgeService {
  private dataSource: DataSource;
  private gamificationService: GamificationService;
  private redisService: RedisService;

  constructor(deps: BadgeServiceDeps) {
    this.dataSource = deps.dataSource;
    this.gamificationService = deps.gamificationService;
    this.redisService = deps.redisService;
  }

  /**
   * Get all badges for a user with progress and unlock status.
   */
  async getUserBadges(userId: string): Promise<UserBadgeWithDef[]> {
    const userBadges = await this.dataSource.getRepository(UserBadge).find({
      where: { userId },
    });

    const badgeMap = new Map(userBadges.map((b) => [b.badgeId, b]));

    return BADGE_DEFINITIONS.map((def) => {
      const ub = badgeMap.get(def.id);
      return {
        badgeId: def.id,
        name: def.name,
        emoji: def.emoji,
        description: def.description,
        threshold: def.threshold,
        progress: ub?.progress ?? 0,
        unlockedAt: ub?.unlockedAt ?? null,
      };
    });
  }

  /**
   * Check and update all badge progress for a user after a check-in.
   * Returns list of newly unlocked badge IDs.
   */
  async checkBadges(userId: string): Promise<string[]> {
    const newlyUnlocked: string[] = [];

    // Load existing user badges
    const existing = await this.dataSource.getRepository(UserBadge).find({
      where: { userId },
    });
    const badgeMap = new Map(existing.map((b) => [b.badgeId, b]));

    // Compute progress for each badge
    for (const def of BADGE_DEFINITIONS) {
      const alreadyUnlocked = badgeMap.get(def.id)?.unlockedAt != null;
      if (alreadyUnlocked) continue;

      const progress = await this.computeProgress(userId, def);

      // Upsert progress
      await this.dataSource.getRepository(UserBadge).upsert(
        {
          userId,
          badgeId: def.id,
          progress,
          unlockedAt: progress >= def.threshold ? new Date() : undefined,
        },
        ["userId", "badgeId"],
      );

      if (progress >= def.threshold) {
        newlyUnlocked.push(def.id);

        // Award XP for badge unlock
        try {
          await this.gamificationService.awardXP(
            userId,
            50,
            `badge_unlock_${def.id}`,
          );
        } catch (err) {
          console.error(`[BadgeService] Failed to award badge XP:`, err);
        }

        // Publish badge unlock event via Redis
        await this.redisService.publishMessage("level-update", {
          type: "level-update",
          data: {
            userId,
            action: "badge_unlocked",
            badgeId: def.id,
            badgeName: def.name,
            badgeEmoji: def.emoji,
            timestamp: new Date().toISOString(),
          },
        });

        console.log(
          `[BadgeService] User ${userId} unlocked badge: ${def.name} ${def.emoji}`,
        );
      }
    }

    return newlyUnlocked;
  }

  private async computeProgress(
    userId: string,
    def: BadgeDefinition,
  ): Promise<number> {
    const { criteria } = def;

    switch (criteria.type) {
      case "category":
        return this.countCategoryCheckins(userId, criteria.categories);

      case "time":
        return this.countTimeCheckins(userId, criteria.direction, criteria.hour);

      case "day":
        return this.countDayCheckins(userId, criteria.days);

      case "category_diversity":
        return this.countDistinctCategories(userId);

      case "completions":
        return this.countCompletions(userId);

      case "streak":
        return this.getCurrentStreak(userId);
    }
  }

  private async countCategoryCheckins(
    userId: string,
    categories: string[],
  ): Promise<number> {
    // Join checkins to items and match venueCategory (case-insensitive, partial match)
    const likeConditions = categories
      .map((_, i) => `LOWER(ii.venue_category) LIKE $${i + 2}`)
      .join(" OR ");
    const params = [userId, ...categories.map((c) => `%${c.toLowerCase()}%`)];

    const result = await this.dataSource.query(
      `SELECT COUNT(DISTINCT ic.id) as count
       FROM itinerary_checkins ic
       JOIN itinerary_items ii ON ii.id = ic.itinerary_item_id
       WHERE ic.user_id = $1
       AND ii.venue_category IS NOT NULL
       AND (${likeConditions})`,
      params,
    );
    return Number(result[0]?.count ?? 0);
  }

  private async countTimeCheckins(
    userId: string,
    direction: "after" | "before",
    hour: number,
  ): Promise<number> {
    const op = direction === "after" ? ">=" : "<";
    const result = await this.dataSource.query(
      `SELECT COUNT(*) as count
       FROM itinerary_checkins
       WHERE user_id = $1
       AND EXTRACT(HOUR FROM checked_in_at) ${op} $2`,
      [userId, hour],
    );
    return Number(result[0]?.count ?? 0);
  }

  private async countDayCheckins(
    userId: string,
    days: number[],
  ): Promise<number> {
    const result = await this.dataSource.query(
      `SELECT COUNT(*) as count
       FROM itinerary_checkins
       WHERE user_id = $1
       AND EXTRACT(DOW FROM checked_in_at) = ANY($2)`,
      [userId, days],
    );
    return Number(result[0]?.count ?? 0);
  }

  private async countDistinctCategories(userId: string): Promise<number> {
    const result = await this.dataSource.query(
      `SELECT COUNT(DISTINCT LOWER(ii.venue_category)) as count
       FROM itinerary_checkins ic
       JOIN itinerary_items ii ON ii.id = ic.itinerary_item_id
       WHERE ic.user_id = $1
       AND ii.venue_category IS NOT NULL`,
      [userId],
    );
    return Number(result[0]?.count ?? 0);
  }

  private async countCompletions(userId: string): Promise<number> {
    const count = await this.dataSource.getRepository(Itinerary).count({
      where: { userId, completedAt: new Date() }, // TypeORM needs a value; use raw query instead
    });
    // Use raw query for non-null check
    const result = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM itineraries WHERE user_id = $1 AND completed_at IS NOT NULL`,
      [userId],
    );
    return Number(result[0]?.count ?? 0);
  }

  private async getCurrentStreak(userId: string): Promise<number> {
    const result = await this.dataSource.query(
      `SELECT current_streak FROM users WHERE id = $1`,
      [userId],
    );
    return Number(result[0]?.current_streak ?? 0);
  }
}

export function createBadgeService(deps: BadgeServiceDeps): BadgeService {
  return new BadgeService(deps);
}
