import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddExternalEventFields1710000000026 implements MigrationInterface {
  name = "AddExternalEventFields1710000000026";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the enum type
    await queryRunner.query(
      `CREATE TYPE "event_source_enum" AS ENUM ('SCAN', 'TICKETMASTER')`,
    );

    // Add source column with default SCAN (backfills existing rows)
    await queryRunner.query(
      `ALTER TABLE "events" ADD COLUMN "source" "event_source_enum" NOT NULL DEFAULT 'SCAN'`,
    );

    // Add external_id column (nullable)
    await queryRunner.query(
      `ALTER TABLE "events" ADD COLUMN "external_id" VARCHAR NULL`,
    );

    // Create partial unique index for deduplication
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_events_source_external_id" ON "events" ("source", "external_id") WHERE "external_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_events_source_external_id"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "external_id"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "source"`);
    await queryRunner.query(`DROP TYPE "event_source_enum"`);
  }
}
