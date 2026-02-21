import { type MigrationInterface, type QueryRunner } from "typeorm";

export class AddSpatialAndCompoundIndexes1710000000024 implements MigrationInterface {
  name = "AddSpatialAndCompoundIndexes1710000000024";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // GIST spatial index on events.location for viewport filtering and distance queries
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_events_location_spatial" ON "events" USING GIST ("location")`,
    );

    // Compound index for status + event_date queries (common filter pattern)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_events_status_event_date" ON "events" ("status", "event_date")`,
    );

    // Compound index for creator lookups filtered by status
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_events_creator_status" ON "events" ("creator_id", "status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_events_creator_status"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_events_status_event_date"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_events_location_spatial"`,
    );
  }
}
