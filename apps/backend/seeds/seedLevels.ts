import { DataSource } from "typeorm";
import { Level } from "../entities/Level";

export async function seedLevels(dataSource: DataSource): Promise<void> {
    const levelRepository = dataSource.getRepository(Level);

    const levels = [
        {
            levelNumber: 1,
            title: "Novice Explorer",
            requiredXp: 0,
            rewards: [],
        },
        {
            levelNumber: 2,
            title: "Event Scout",
            requiredXp: 100,
            rewards: [
                {
                    type: "SCAN_LIMIT_INCREASE",
                    value: 5,
                },
            ],
        },
        {
            levelNumber: 3,
            title: "Community Guide",
            requiredXp: 250,
            rewards: [
                {
                    type: "SPECIAL_BADGE",
                    value: "scout_badge",
                },
            ],
        },
        {
            levelNumber: 4,
            title: "Discovery Aficionado",
            requiredXp: 500,
            rewards: [],
        },
        {
            levelNumber: 5,
            title: "Event Maestro",
            requiredXp: 1000,
            rewards: [
                {
                    type: "SCAN_LIMIT_INCREASE",
                    value: 10,
                },
                {
                    type: "CUSTOM_THEME",
                    value: "explorer_theme",
                },
            ],
        },
        {
            levelNumber: 6,
            title: "Urban Legend",
            requiredXp: 2000,
            rewards: [],
        },
        {
            levelNumber: 7,
            title: "Local Hero",
            requiredXp: 3500,
            rewards: [
                {
                    type: "EMOJI_PACK",
                    value: "adventure_emojis",
                },
            ],
        },
        {
            levelNumber: 8,
            title: "Grand Explorer",
            requiredXp: 5000,
            rewards: [],
        },
        {
            levelNumber: 9,
            title: "Discovery Master",
            requiredXp: 7500,
            rewards: [],
        },
        {
            levelNumber: 10,
            title: "Event Visionary",
            requiredXp: 10000,
            rewards: [
                {
                    type: "SCAN_LIMIT_INCREASE",
                    value: 25,
                },
                {
                    type: "PREMIUM_FEATURE",
                    value: "advanced_filters",
                },
            ],
        },
    ];

    const levelEntities = levels.map((levelData) => {
        const level = new Level();
        level.levelNumber = levelData.levelNumber;
        level.title = levelData.title;
        level.requiredXp = levelData.requiredXp;
        level.rewards = levelData.rewards as { type: "SCAN_LIMIT_INCREASE" | "SPECIAL_BADGE" | "PREMIUM_FEATURE" | "CUSTOM_THEME" | "EMOJI_PACK"; value: string | number }[];
        return level;
    });

    await levelRepository.save(levelEntities);
    console.log(`✅ Successfully seeded ${levelEntities.length} levels`);
} 