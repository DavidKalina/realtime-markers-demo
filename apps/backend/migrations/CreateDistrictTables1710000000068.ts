import { type MigrationInterface, type QueryRunner } from "typeorm";

export class CreateDistrictTables1710000000068 implements MigrationInterface {
  name = "CreateDistrictTables1710000000068";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE districts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        description TEXT,
        geohash VARCHAR(12) NOT NULL,
        centroid_lat NUMERIC(10,7) NOT NULL,
        centroid_lng NUMERIC(10,7) NOT NULL,
        embedding_centroid TEXT,
        activity_tags TEXT[] DEFAULT '{}',
        itinerary_count INT DEFAULT 0,
        avg_rating NUMERIC(3,2) DEFAULT 0,
        total_adoptions INT DEFAULT 0,
        status VARCHAR(20) DEFAULT 'active',
        last_clustered_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IDX_district_geohash ON districts (geohash)
    `);

    await queryRunner.query(`
      CREATE INDEX IDX_district_status ON districts (status)
    `);

    await queryRunner.query(`
      CREATE INDEX IDX_district_centroid ON districts (centroid_lat, centroid_lng)
    `);

    await queryRunner.query(`
      CREATE TABLE district_itineraries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        district_id UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
        itinerary_id UUID NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
        similarity NUMERIC(4,3),
        added_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (district_id, itinerary_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IDX_di_district ON district_itineraries (district_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IDX_di_itinerary ON district_itineraries (itinerary_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS district_itineraries`);
    await queryRunner.query(`DROP TABLE IF EXISTS districts`);
  }
}
