import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddEventDigest1710000000027 implements MigrationInterface {
  name = "AddEventDigest1710000000027";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD COLUMN "event_digest" jsonb NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "event_digest"`);
  }
}
