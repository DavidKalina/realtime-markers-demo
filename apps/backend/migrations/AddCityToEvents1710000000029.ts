import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddCityToEvents1710000000029 implements MigrationInterface {
  name = "AddCityToEvents1710000000029";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add nullable city column
    await queryRunner.query(
      `ALTER TABLE "events" ADD COLUMN "city" varchar NULL`,
    );

    // Backfill city from existing address field
    // Ticketmaster addresses look like: "Venue Name, 123 Street, Denver, CO, 80204"
    // Scanned addresses may look like: "123 Street, Denver, CO 80204"
    // This regex matches "City, ST" followed by optional zip (comma- or space-separated)
    await queryRunner.query(`
      UPDATE events
      SET city = m[1] || ', ' || m[2]
      FROM (
        SELECT id, regexp_match(address, '([A-Za-z ]+),\s*([A-Z]{2})(?:[,\s]+\d{5})?(?:,\s*[A-Z]{2,})?$') AS m
        FROM events
        WHERE address IS NOT NULL
      ) AS sub
      WHERE events.id = sub.id AND sub.m IS NOT NULL
    `);

    // Add partial index on city where not null
    await queryRunner.query(
      `CREATE INDEX "IDX_events_city" ON "events" ("city") WHERE "city" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_events_city"`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "city"`);
  }
}
