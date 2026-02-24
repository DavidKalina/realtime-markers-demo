import { DataSource, type EntityManager } from "typeorm";
import type { RedisService, LevelUpdateMessage } from "./shared/RedisService";

// Tier definitions
const TIERS = [
  { name: "Explorer", minXp: 0, emoji: "\u{1F9ED}" },
  { name: "Scout", minXp: 500, emoji: "\u{1F52D}" },
  { name: "Curator", minXp: 2000, emoji: "\u{2B50}" },
  { name: "Ambassador", minXp: 5000, emoji: "\u{1F451}" },
] as const;

export function getTierForXP(xp: number): {
  name: string;
  emoji: string;
  index: number;
} {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (xp >= TIERS[i].minXp) {
      return { name: TIERS[i].name, emoji: TIERS[i].emoji, index: i };
    }
  }
  return { name: TIERS[0].name, emoji: TIERS[0].emoji, index: 0 };
}

export function getNextTierThreshold(xp: number): number | null {
  for (const tier of TIERS) {
    if (xp < tier.minXp) {
      return tier.minXp;
    }
  }
  return null; // Already at max tier
}

export interface AwardXPResult {
  newTotalXp: number;
  previousTier: string;
  currentTier: string;
  tierChanged: boolean;
}

export interface GamificationServiceDependencies {
  dataSource: DataSource;
  redisService: RedisService;
}

export class GamificationService {
  private dataSource: DataSource;
  private redisService: RedisService;

  constructor(dependencies: GamificationServiceDependencies) {
    this.dataSource = dependencies.dataSource;
    this.redisService = dependencies.redisService;
  }

  async awardXP(
    userId: string,
    amount: number,
    action: string,
    entityManager?: EntityManager,
  ): Promise<AwardXPResult> {
    // Use the provided entity manager (to share a transaction connection)
    // or fall back to the dataSource for standalone calls.
    const queryRunner = entityManager ?? this.dataSource;

    // Atomic increment to avoid race conditions
    const result = await queryRunner.query(
      `UPDATE users SET total_xp = total_xp + $1 WHERE id = $2 RETURNING total_xp, current_tier`,
      [amount, userId],
    );

    if (!result || result.length === 0) {
      throw new Error(`User ${userId} not found`);
    }

    const { total_xp: newTotalXp, current_tier: previousTier } = result[0];
    console.log(
      `XP awarded: userId=${userId}, amount=${amount}, action=${action}, newTotal=${newTotalXp}`,
    );
    const tier = getTierForXP(newTotalXp);
    // Treat null/undefined previousTier as "Explorer" (the default tier)
    const effectivePreviousTier = previousTier || "Explorer";
    const tierChanged = tier.name !== effectivePreviousTier;

    // Update tier if changed, or if it was never set (NULL in DB)
    if (tierChanged || !previousTier) {
      await queryRunner.query(
        `UPDATE users SET current_tier = $1 WHERE id = $2`,
        [tier.name, userId],
      );
    }

    // Publish level-up event
    if (tierChanged) {
      const levelUpMessage: LevelUpdateMessage = {
        type: "level-update",
        data: {
          userId,
          level: tier.index,
          title: tier.name,
          action: "level_up",
          amount,
          totalXp: newTotalXp,
          timestamp: new Date().toISOString(),
        },
      };
      await this.redisService.publishMessage("level-update", levelUpMessage);
    }

    // Always publish XP awarded event
    const xpMessage: LevelUpdateMessage = {
      type: "level-update",
      data: {
        userId,
        level: tier.index,
        title: tier.name,
        action: "xp_awarded",
        amount,
        totalXp: newTotalXp,
        timestamp: new Date().toISOString(),
      },
    };
    await this.redisService.publishMessage("level-update", xpMessage);

    return {
      newTotalXp,
      previousTier: previousTier || "Explorer",
      currentTier: tier.name,
      tierChanged,
    };
  }
}

export function createGamificationService(
  dependencies: GamificationServiceDependencies,
): GamificationService {
  return new GamificationService(dependencies);
}
