import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOnboardingProfile1710000000059 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "preference_embedding" text,
      ADD COLUMN IF NOT EXISTS "onboarding_profile" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "preference_embedding",
      DROP COLUMN IF EXISTS "onboarding_profile"
    `);
  }
}
