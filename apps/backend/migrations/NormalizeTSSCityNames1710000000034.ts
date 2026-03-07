import { type MigrationInterface, type QueryRunner } from "typeorm";

export class NormalizeTSSCityNames1710000000034 implements MigrationInterface {
  name = "NormalizeTSSCityNames1710000000034";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Normalize existing city names to consistent "City, ST" format:
    // 1. Trim whitespace
    // 2. Ensure single space after commas
    // 3. Title-case city name, uppercase state abbreviation
    // 4. Deduplicate rows that collapse to the same normalized city + computed_at day

    // Step 1: Normalize the city column values
    await queryRunner.query(`
      UPDATE third_space_score_snapshots
      SET city = CONCAT(
        INITCAP(TRIM(SPLIT_PART(city, ',', 1))),
        CASE
          WHEN POSITION(',' IN city) > 0
          THEN ', ' || UPPER(TRIM(SPLIT_PART(city, ',', 2)))
          ELSE ''
        END
      )
    `);

    // Step 2: Remove exact duplicates (same city, keep the latest snapshot per computed_at)
    await queryRunner.query(`
      DELETE FROM third_space_score_snapshots a
      USING third_space_score_snapshots b
      WHERE a.city = b.city
        AND a.computed_at = b.computed_at
        AND a.id < b.id
    `);

    // Step 3: Add index on normalized city to speed up LOWER() lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tss_city_lower"
      ON "third_space_score_snapshots" (LOWER("city"))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tss_city_lower"`);
  }
}
