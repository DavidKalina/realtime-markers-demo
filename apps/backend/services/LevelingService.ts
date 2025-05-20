import { DataSource, Repository } from "typeorm";
import { User } from "../entities/User";
import { Level } from "../entities/Level";
import { UserLevel } from "../entities/UserLevel";
import { Redis } from "ioredis";
import { RedisService } from "./shared/RedisService";
import { LevelingCacheService } from "./shared/LevelingCacheService";

export class LevelingService {
  private userRepository: Repository<User>;
  private levelRepository: Repository<Level>;
  private userLevelRepository: Repository<UserLevel>;
  private redisService: RedisService;

  constructor(dataSource: DataSource, redis: Redis) {
    this.userRepository = dataSource.getRepository(User);
    this.levelRepository = dataSource.getRepository(Level);
    this.userLevelRepository = dataSource.getRepository(UserLevel);
    this.redisService = RedisService.getInstance(redis);
  }

  /**
   * Get all levels with caching
   */
  private async getAllLevels(): Promise<Level[]> {
    // Try to get from cache first
    const cachedLevels = await LevelingCacheService.getLevels();
    if (cachedLevels) {
      return cachedLevels;
    }

    // Fetch fresh levels from database
    const levels = await this.levelRepository.find({
      order: { levelNumber: "ASC" },
    });

    if (levels.length === 0) {
      throw new Error("No levels found in database");
    }

    // Cache the levels
    await LevelingCacheService.setLevels(levels);

    return levels;
  }

  /**
   * Award XP to a user for a specific action
   */
  async awardXp(userId: string, amount: number): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new Error("User not found");

    // Update total XP
    user.totalXp += amount;
    await this.userRepository.save(user);

    // Update XP cache
    await LevelingCacheService.setUserXp(userId, user.totalXp);

    // Get current level before XP award
    const oldLevel = await this.getCurrentLevel(userId);

    // Get new level after XP award
    const newLevel = await this.getCurrentLevel(userId);

    // If level changed, update user's title and publish level up event
    if (newLevel.levelNumber > oldLevel.levelNumber) {
      user.currentTitle = newLevel.title;
      await this.userRepository.save(user);

      // Publish level-up event
      await this.redisService.publish("level-update", {
        type: "LEVEL_UP",
        data: {
          userId,
          level: newLevel.levelNumber,
          title: newLevel.title,
          action: "level_up",
          timestamp: new Date().toISOString(),
        },
      });

      // Invalidate user's level info cache
      await LevelingCacheService.invalidateUserCaches(userId);
    }

    // Publish XP award event
    await this.redisService.publish("level-update", {
      type: "XP_AWARDED",
      data: {
        userId,
        action: "xp_awarded",
        amount,
        totalXp: user.totalXp,
        timestamp: new Date().toISOString(),
      },
    });

    // Update current level progress
    const userLevel = await this.userLevelRepository.findOne({
      where: { userId, levelId: newLevel.id },
    });

    if (userLevel && !userLevel.isCompleted) {
      userLevel.currentXp += amount;

      // Check if level is completed
      if (userLevel.currentXp >= newLevel.requiredXp) {
        userLevel.isCompleted = true;
        userLevel.completedAt = new Date();

        // Apply rewards if any
        if (newLevel.rewards) {
          await this.applyRewards(userId, newLevel.rewards);
        }
      }

      await this.userLevelRepository.save(userLevel);
    }
  }

  /**
   * Get user's current level
   */
  private async getCurrentLevel(userId: string): Promise<Level> {
    const levels = await this.getAllLevels();
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error("User not found");
    }

    // Find the highest level where user's XP meets the requirement
    let currentLevel = levels[0]; // Start with level 1
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const nextLevel = levels[i + 1];

      // If this is the last level, stay at current level
      if (!nextLevel) {
        currentLevel = level;
        break;
      }

      // If user's XP meets the next level's requirement, move to next level
      if (user.totalXp >= nextLevel.requiredXp) {
        currentLevel = nextLevel;
      } else {
        // If user's XP is less than next level's requirement, stay at current level
        currentLevel = level;
        break;
      }
    }

    return currentLevel;
  }

  /**
   * Get user's current level information
   */
  async getUserLevelInfo(userId: string): Promise<{
    currentLevel: number;
    currentTitle: string;
    totalXp: number;
    nextLevelXp: number;
    progress: number;
  }> {
    // Try to get from cache first
    const cachedInfo = await LevelingCacheService.getUserLevelInfo(userId);
    if (cachedInfo) {
      return cachedInfo;
    }

    // Get user and levels in parallel
    const [user, levels] = await Promise.all([
      this.userRepository.findOne({ where: { id: userId } }),
      this.getAllLevels(),
    ]);

    if (!user) throw new Error("User not found");

    try {
      const currentLevel = this.determineLevel(levels, user.totalXp);
      const nextLevel = levels.find(
        (l) => l.levelNumber === currentLevel.levelNumber + 1,
      );

      // Calculate progress based on current level
      let progress = 0;
      if (nextLevel) {
        // Calculate progress towards next level, considering rolled over XP
        const xpForCurrentLevel = currentLevel.requiredXp;
        const xpForNextLevel = nextLevel.requiredXp;
        const xpNeededForNextLevel = xpForNextLevel - xpForCurrentLevel;
        const xpProgress = user.totalXp - xpForCurrentLevel;

        progress = Math.min((xpProgress / xpNeededForNextLevel) * 100, 100);
      } else {
        // If there's no next level, progress is 100%
        progress = 100;
      }

      const levelInfo = {
        currentLevel: currentLevel.levelNumber,
        currentTitle: currentLevel.title,
        totalXp: user.totalXp,
        nextLevelXp: nextLevel?.requiredXp ?? currentLevel.requiredXp,
        progress: progress,
      };

      // Cache the level info
      await LevelingCacheService.setUserLevelInfo(userId, levelInfo);

      return levelInfo;
    } catch (error) {
      console.error("Error getting level info:", error);
      return {
        currentLevel: 1,
        currentTitle: "Novice Explorer",
        totalXp: user.totalXp,
        nextLevelXp: 100,
        progress: Math.min((user.totalXp / 100) * 100, 100),
      };
    }
  }

  /**
   * Determine level based on XP (without database query)
   */
  private determineLevel(levels: Level[], totalXp: number): Level {
    let currentLevel = levels[0]; // Start with level 1
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const nextLevel = levels[i + 1];

      // If this is the last level, stay at current level
      if (!nextLevel) {
        currentLevel = level;
        break;
      }

      // If user's XP meets the next level's requirement, move to next level
      if (totalXp >= nextLevel.requiredXp) {
        currentLevel = nextLevel;
      } else {
        // If user's XP is less than next level's requirement, stay at current level
        currentLevel = level;
        break;
      }
    }

    return currentLevel;
  }

  /**
   * Apply rewards for completing a level
   */
  private async applyRewards(
    userId: string,
    rewards: {
      type:
        | "SCAN_LIMIT_INCREASE"
        | "SPECIAL_BADGE"
        | "PREMIUM_FEATURE"
        | "CUSTOM_THEME"
        | "EMOJI_PACK";
      value: number | string;
    }[],
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return;

    for (const reward of rewards) {
      switch (reward.type) {
        case "SCAN_LIMIT_INCREASE":
          // Increase weekly scan limit
          user.weeklyScanCount += reward.value as number;
          break;
        case "SPECIAL_BADGE":
          // Add badge to user profile
          // TODO: Implement badge system
          break;
        case "PREMIUM_FEATURE":
          // Unlock premium feature
          // TODO: Implement premium features
          break;
        case "CUSTOM_THEME":
          // Unlock custom theme
          // TODO: Implement theme system
          break;
        case "EMOJI_PACK":
          // Unlock emoji pack
          // TODO: Implement emoji pack system
          break;
      }
    }

    await this.userRepository.save(user);
    // Invalidate user caches after applying rewards
    await LevelingCacheService.invalidateUserCaches(userId);
  }

  /**
   * Reset a user's XP and level progress
   */
  async resetUserXp(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new Error("User not found");

    // Reset user's XP and title
    user.totalXp = 0;
    user.currentTitle = "Novice Explorer";
    await this.userRepository.save(user);

    // Delete all user level records
    await this.userLevelRepository.delete({ userId });

    // Create new level 1 record
    const level1 = await this.levelRepository.findOne({
      where: { levelNumber: 1 },
    });
    if (!level1) throw new Error("Level 1 not found");

    const userLevel = new UserLevel();
    userLevel.userId = userId;
    userLevel.levelId = level1.id;
    userLevel.currentXp = 0;
    userLevel.isCompleted = false;
    await this.userLevelRepository.save(userLevel);

    // Invalidate all user caches
    await LevelingCacheService.invalidateUserCaches(userId);

    // Publish reset event
    await this.redisService.publish("level-update", {
      type: "LEVEL_RESET",
      data: {
        userId,
        level: 1,
        title: "Novice Explorer",
        action: "reset",
        timestamp: new Date().toISOString(),
      },
    });
  }
}
