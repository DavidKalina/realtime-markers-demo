import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddItineraryCheckins1710000000038 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add checked_in_at timestamp to itinerary items
    await queryRunner.query(
      `ALTER TABLE "itinerary_items" ADD COLUMN "checked_in_at" timestamptz`,
    );

    // Track which itinerary the user is currently walking
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "active_itinerary_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_users_active_itinerary" FOREIGN KEY ("active_itinerary_id") REFERENCES "itineraries"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_active_itinerary" ON "users" ("active_itinerary_id") WHERE "active_itinerary_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_users_active_itinerary"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_users_active_itinerary"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "active_itinerary_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "itinerary_items" DROP COLUMN "checked_in_at"`,
    );
  }
}
