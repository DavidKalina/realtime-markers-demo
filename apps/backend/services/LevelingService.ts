import { DataSource, Repository } from "typeorm";
import { User } from "../entities/User";
import { Level } from "../entities/Level";
import { UserLevel } from "../entities/UserLevel";
import { Redis } from "ioredis";

export class LevelingService {
    private userRepository: Repository<User>;
    private levelRepository: Repository<Level>;
    private userLevelRepository: Repository<UserLevel>;
    private redis: Redis;

    constructor(dataSource: DataSource, redis: Redis) {
        this.userRepository = dataSource.getRepository(User);
        this.levelRepository = dataSource.getRepository(Level);
        this.userLevelRepository = dataSource.getRepository(UserLevel);
        this.redis = redis;
    }

    /**
     * Award XP to a user for a specific action
     */
    async awardXp(userId: string, action: "DISCOVERY" | "SAVE" | "CREATION" | "LOGIN", amount: number): Promise<void> {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) throw new Error("User not found");

        // Update total XP
        user.totalXp += amount;
        await this.userRepository.save(user);

        // Get current level before XP award
        const oldLevel = await this.getCurrentLevel(userId);

        // Get new level after XP award
        const newLevel = await this.getCurrentLevel(userId);

        // If level changed, update user's title and publish level up event
        if (newLevel.levelNumber > oldLevel.levelNumber) {
            user.currentTitle = newLevel.title;
            await this.userRepository.save(user);

            // Publish level-up event
            await this.redis.publish(
                "level-update",
                JSON.stringify({
                    userId,
                    level: newLevel.levelNumber,
                    title: newLevel.title,
                    action: "level_up",
                    timestamp: new Date().toISOString(),
                })
            );
        }

        // Publish XP award event
        await this.redis.publish(
            "level-update",
            JSON.stringify({
                userId,
                action: "xp_awarded",
                amount,
                totalXp: user.totalXp,
                timestamp: new Date().toISOString(),
            })
        );

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
     * Get user's current level information
     */
    async getUserLevelInfo(userId: string): Promise<{
        currentLevel: number;
        currentTitle: string;
        totalXp: number;
        nextLevelXp: number;
        progress: number;
    }> {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) throw new Error("User not found");

        try {
            const currentLevel = await this.getCurrentLevel(userId);
            const nextLevel = await this.levelRepository.findOne({
                where: { levelNumber: currentLevel.levelNumber + 1 },
            });

            // Calculate progress based on current level
            let progress = 0;
            if (nextLevel) {
                // Calculate progress towards next level, considering rolled over XP
                const xpForCurrentLevel = currentLevel.requiredXp;
                const xpForNextLevel = nextLevel.requiredXp;
                const xpNeededForNextLevel = xpForNextLevel - xpForCurrentLevel;
                const xpProgress = user.totalXp - xpForCurrentLevel; // This already includes rolled over XP

                progress = Math.min((xpProgress / xpNeededForNextLevel) * 100, 100);
            } else {
                // If there's no next level, progress is 100%
                progress = 100;
            }

            console.log("Level info calculation:", {
                userId,
                totalXp: user.totalXp,
                currentLevel: currentLevel.levelNumber,
                currentLevelRequiredXp: currentLevel.requiredXp,
                nextLevelRequiredXp: nextLevel?.requiredXp,
                xpProgress: user.totalXp - currentLevel.requiredXp,
                xpNeededForNextLevel: nextLevel ? nextLevel.requiredXp - currentLevel.requiredXp : 0,
                calculatedProgress: progress
            });

            return {
                currentLevel: currentLevel.levelNumber,
                currentTitle: currentLevel.title,
                totalXp: user.totalXp,
                nextLevelXp: nextLevel?.requiredXp ?? currentLevel.requiredXp,
                progress: progress,
            };
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
     * Get user's current level
     */
    private async getCurrentLevel(userId: string): Promise<Level> {
        const levels = await this.levelRepository.find({
            order: { levelNumber: "ASC" },
        });

        if (levels.length === 0) {
            throw new Error("No levels found in database");
        }

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

        console.log("Level determination:", {
            userId,
            totalXp: user.totalXp,
            determinedLevel: currentLevel.levelNumber,
            requiredXp: currentLevel.requiredXp
        });

        return currentLevel;
    }

    /**
     * Apply rewards for completing a level
     */
    private async applyRewards(
        userId: string,
        rewards: {
            type: "SCAN_LIMIT_INCREASE" | "SPECIAL_BADGE" | "PREMIUM_FEATURE" | "CUSTOM_THEME" | "EMOJI_PACK";
            value: number | string;
        }[]
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
        const level1 = await this.levelRepository.findOne({ where: { levelNumber: 1 } });
        if (!level1) throw new Error("Level 1 not found");

        const userLevel = new UserLevel();
        userLevel.userId = userId;
        userLevel.levelId = level1.id;
        userLevel.currentXp = 0;
        userLevel.isCompleted = false;
        await this.userLevelRepository.save(userLevel);

        // Publish reset event
        await this.redis.publish(
            "level-update",
            JSON.stringify({
                userId,
                level: 1,
                title: "Novice Explorer",
                action: "reset",
            })
        );
    }
} 