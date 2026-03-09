import type { MigrationInterface, QueryRunner } from "typeorm";

export class ItineraryCheckinsTable1710000000039 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "itinerary_checkins" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "itinerary_id" uuid NOT NULL REFERENCES "itineraries"("id") ON DELETE CASCADE,
        "itinerary_item_id" uuid NOT NULL REFERENCES "itinerary_items"("id") ON DELETE CASCADE,
        "user_latitude" numeric(10, 7),
        "user_longitude" numeric(10, 7),
        "distance_meters" numeric(8, 2),
        "planned_time" varchar(5),
        "source" varchar(20) NOT NULL DEFAULT 'proximity',
        "item_sort_order" int NOT NULL,
        "skipped_item_ids" uuid[] NOT NULL DEFAULT '{}',
        "checked_in_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_itinerary_checkins_user_itinerary" ON "itinerary_checkins" ("user_id", "itinerary_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itinerary_checkins_itinerary" ON "itinerary_checkins" ("itinerary_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itinerary_checkins_checked_in_at" ON "itinerary_checkins" ("checked_in_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "itinerary_checkins"`);
  }
}
