import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddLevelingSystem1710000000003 implements MigrationInterface {
  name = "AddLevelingSystem1710000000003";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create levels table
    await queryRunner.query(`
      CREATE TABLE "levels" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "level_number" integer NOT NULL,
        "title" character varying NOT NULL,
        "required_xp" integer NOT NULL,
        "rewards" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_levels_level_number" UNIQUE ("level_number"),
        CONSTRAINT "PK_levels" PRIMARY KEY ("id")
      )
    `);

    // Create user_levels table
    await queryRunner.query(`
      CREATE TABLE "user_levels" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "level_id" uuid NOT NULL,
        "current_xp" integer NOT NULL DEFAULT '0',
        "is_completed" boolean NOT NULL DEFAULT false,
        "completed_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_levels_user_id_level_id" UNIQUE ("user_id", "level_id"),
        CONSTRAINT "PK_user_levels" PRIMARY KEY ("id")
      )
    `);

    // Add indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_user_levels_user_id" ON "user_levels" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_user_levels_level_id" ON "user_levels" ("level_id")
    `);

    // Add foreign keys
    await queryRunner.query(`
      ALTER TABLE "user_levels"
      ADD CONSTRAINT "FK_user_levels_user_id"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "user_levels"
      ADD CONSTRAINT "FK_user_levels_level_id"
      FOREIGN KEY ("level_id") REFERENCES "levels"("id")
      ON DELETE CASCADE
    `);

    // Seed levels
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

    // Insert levels
    for (const level of levels) {
      await queryRunner.query(
        `
        INSERT INTO "levels" ("level_number", "title", "required_xp", "rewards")
        VALUES ($1, $2, $3, $4)
      `,
        [level.levelNumber, level.title, level.requiredXp, JSON.stringify(level.rewards)]
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign keys
    await queryRunner.query(`
      ALTER TABLE "user_levels"
      DROP CONSTRAINT "FK_user_levels_user_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "user_levels"
      DROP CONSTRAINT "FK_user_levels_level_id"
    `);

    // Remove indexes
    await queryRunner.query(`
      DROP INDEX "IDX_user_levels_user_id"
    `);
    await queryRunner.query(`
      DROP INDEX "IDX_user_levels_level_id"
    `);

    // Drop tables
    await queryRunner.query(`
      DROP TABLE "user_levels"
    `);
    await queryRunner.query(`
      DROP TABLE "levels"
    `);
  }
}
