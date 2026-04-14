import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddOnboardingPhase1775800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_phase INTEGER NOT NULL DEFAULT 0`,
    );
    // Existing users who completed the old onboarding flow should skip progressive collection
    await queryRunner.query(
      `UPDATE users SET onboarding_phase = 3 WHERE comfort_profile IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE users DROP COLUMN IF EXISTS onboarding_phase`,
    );
  }
}
