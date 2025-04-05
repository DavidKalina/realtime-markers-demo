import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserOnboardingStatus1710000000000 implements MigrationInterface {
    name = 'AddUserOnboardingStatus1710000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "users" 
            ADD COLUMN "is_onboarded" boolean NOT NULL DEFAULT false,
            ADD COLUMN "onboarding_completed_at" timestamptz NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "users" 
            DROP COLUMN "is_onboarded",
            DROP COLUMN "onboarding_completed_at"
        `);
    }
} 