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

        // Get current level
        const currentLevel = await this.getCurrentLevel(userId);
        if (!currentLevel) return;

        // Update current level progress
        const userLevel = await this.userLevelRepository.findOne({
            where: { userId, levelId: currentLevel.id },
        });

        if (userLevel && !userLevel.isCompleted) {
            userLevel.currentXp += amount;

            // Check if level is completed
            if (userLevel.currentXp >= currentLevel.requiredXp) {
                userLevel.isCompleted = true;
                userLevel.completedAt = new Date();
                user.currentTitle = currentLevel.title;

                // Apply rewards if any
                if (currentLevel.rewards) {
                    await this.applyRewards(userId, currentLevel.rewards);
                }

                // Publish level-up event
                await this.redis.publish(
                    "level-update",
                    JSON.stringify({
                        userId,
                        level: currentLevel.levelNumber,
                        title: currentLevel.title,
                        action: "level_up",
                        timestamp: new Date().toISOString(),
                    })
                );
            }

            await this.userLevelRepository.save(userLevel);
            await this.userRepository.save(user);
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

        const currentLevel = await this.getCurrentLevel(userId);
        if (!currentLevel) {
            return {
                currentLevel: 0,
                currentTitle: "Novice Explorer",
                totalXp: user.totalXp,
                nextLevelXp: 100,
                progress: 0,
            };
        }

        const nextLevel = await this.levelRepository.findOne({
            where: { levelNumber: currentLevel.levelNumber + 1 },
        });

        return {
            currentLevel: currentLevel.levelNumber,
            currentTitle: currentLevel.title,
            totalXp: user.totalXp,
            nextLevelXp: nextLevel?.requiredXp ?? currentLevel.requiredXp,
            progress: (user.totalXp / currentLevel.requiredXp) * 100,
        };
    }

    /**
     * Get user's current level
     */
    private async getCurrentLevel(userId: string): Promise<Level | null> {
        const levels = await this.levelRepository.find({
            order: { levelNumber: "ASC" },
        });

        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) return null;

        for (let i = levels.length - 1; i >= 0; i--) {
            if (user.totalXp >= levels[i].requiredXp) {
                return levels[i];
            }
        }

        return levels[0];
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