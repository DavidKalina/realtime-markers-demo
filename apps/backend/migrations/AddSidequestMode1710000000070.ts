import { type MigrationInterface, type QueryRunner } from "typeorm";

export class AddSidequestMode1710000000070 implements MigrationInterface {
  name = "AddSidequestMode1710000000070";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the enum type (if not exists)
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE itinerary_mode_enum AS ENUM ('ITINERARY', 'SIDEQUEST');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    // Add mode column with default so existing rows become ITINERARY
    await queryRunner.query(`
      ALTER TABLE itineraries
        ADD COLUMN IF NOT EXISTS mode itinerary_mode_enum NOT NULL DEFAULT 'ITINERARY'
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_itinerary_mode ON itineraries (mode)
    `);

    // Add prompt column for free-text quest input
    await queryRunner.query(`
      ALTER TABLE itineraries
        ADD COLUMN IF NOT EXISTS prompt TEXT
    `);

    // Add radius_miles column for distance slider
    await queryRunner.query(`
      ALTER TABLE itineraries
        ADD COLUMN IF NOT EXISTS radius_miles NUMERIC(5,1)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE itineraries DROP COLUMN IF EXISTS radius_miles`);
    await queryRunner.query(`ALTER TABLE itineraries DROP COLUMN IF EXISTS prompt`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_itinerary_mode`);
    await queryRunner.query(`ALTER TABLE itineraries DROP COLUMN IF EXISTS mode`);
    await queryRunner.query(`DROP TYPE IF EXISTS itinerary_mode_enum`);
  }
}
