import { type MigrationInterface, type QueryRunner } from "typeorm";

export class MergeStatelessCities1710000000067 implements MigrationInterface {
  name = "MergeStatelessCities1710000000067";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Update stateless itinerary cities ("Longmont") to their "City, ST"
    //    form when a matching itinerary with state already exists.
    await queryRunner.query(`
      UPDATE itineraries i
      SET city = match.canonical
      FROM (
        SELECT DISTINCT
          bare.city AS bare_city,
          (SELECT i2.city FROM itineraries i2
           WHERE i2.city LIKE bare.city || ',%'
           LIMIT 1) AS canonical
        FROM itineraries bare
        WHERE bare.city IS NOT NULL
          AND bare.city NOT LIKE '%,%'
      ) match
      WHERE i.city = match.bare_city
        AND match.canonical IS NOT NULL
    `);

    // 2. For any remaining stateless itinerary cities, try matching against
    //    snapshot cities that have the state code.
    await queryRunner.query(`
      UPDATE itineraries i
      SET city = match.canonical
      FROM (
        SELECT DISTINCT
          bare.city AS bare_city,
          (SELECT s.city FROM third_space_score_snapshots s
           WHERE s.city LIKE bare.city || ',%'
           LIMIT 1) AS canonical
        FROM itineraries bare
        WHERE bare.city IS NOT NULL
          AND bare.city NOT LIKE '%,%'
      ) match
      WHERE i.city = match.bare_city
        AND match.canonical IS NOT NULL
    `);

    // 3. Delete stateless snapshots that have a "City, ST" counterpart.
    await queryRunner.query(`
      DELETE FROM third_space_score_snapshots
      WHERE city NOT LIKE '%,%'
        AND EXISTS (
          SELECT 1 FROM third_space_score_snapshots s2
          WHERE s2.city LIKE third_space_score_snapshots.city || ',%'
        )
    `);

    // 4. Delete any remaining stateless snapshots.
    //    computeAllCities will recompute from the (now fixed) itineraries.
    await queryRunner.query(`
      DELETE FROM third_space_score_snapshots
      WHERE city NOT LIKE '%,%'
    `);
  }

  public async down(): Promise<void> {
    // Not reversible
  }
}
