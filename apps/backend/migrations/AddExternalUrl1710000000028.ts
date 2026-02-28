import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddExternalUrl1710000000028 implements MigrationInterface {
  name = "AddExternalUrl1710000000028";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD COLUMN "external_url" text NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN "external_url"`,
    );
  }
}
