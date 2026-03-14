import { type MigrationInterface, type QueryRunner } from "typeorm";

export class RenameThirdSpaceScoreColumns1710000000054 implements MigrationInterface {
  name = "RenameThirdSpaceScoreColumns1710000000054";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "third_space_score_snapshots" RENAME COLUMN "vitality_score" TO "activity_score"`,
    );
    await queryRunner.query(
      `ALTER TABLE "third_space_score_snapshots" RENAME COLUMN "discovery_score" TO "follow_through_score"`,
    );
    await queryRunner.query(
      `ALTER TABLE "third_space_score_snapshots" RENAME COLUMN "diversity_score" TO "variety_score"`,
    );
    await queryRunner.query(
      `ALTER TABLE "third_space_score_snapshots" RENAME COLUMN "engagement_score" TO "satisfaction_score"`,
    );
    await queryRunner.query(
      `ALTER TABLE "third_space_score_snapshots" RENAME COLUMN "rootedness_score" TO "community_score"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "third_space_score_snapshots" RENAME COLUMN "activity_score" TO "vitality_score"`,
    );
    await queryRunner.query(
      `ALTER TABLE "third_space_score_snapshots" RENAME COLUMN "follow_through_score" TO "discovery_score"`,
    );
    await queryRunner.query(
      `ALTER TABLE "third_space_score_snapshots" RENAME COLUMN "variety_score" TO "diversity_score"`,
    );
    await queryRunner.query(
      `ALTER TABLE "third_space_score_snapshots" RENAME COLUMN "satisfaction_score" TO "engagement_score"`,
    );
    await queryRunner.query(
      `ALTER TABLE "third_space_score_snapshots" RENAME COLUMN "community_score" TO "rootedness_score"`,
    );
  }
}
