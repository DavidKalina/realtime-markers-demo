import { type MigrationInterface, type QueryRunner } from "typeorm";

export class CreateDistrictSnapshots1710000000069
  implements MigrationInterface
{
  name = "CreateDistrictSnapshots1710000000069";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE district_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        district_id UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
        itinerary_count INTEGER NOT NULL,
        unique_explorers INTEGER DEFAULT 0,
        weekly_adoptions INTEGER DEFAULT 0,
        weekly_new_itineraries INTEGER DEFAULT 0,
        avg_rating NUMERIC(3,2) DEFAULT 0,
        computed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IDX_ds_district_computed
      ON district_snapshots (district_id, computed_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS district_snapshots`);
  }
}
