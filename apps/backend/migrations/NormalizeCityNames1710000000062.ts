import { type MigrationInterface, type QueryRunner } from "typeorm";

/**
 * Normalize city names across events, itineraries, and third_space_score_snapshots
 * to a consistent "City Name, ST" format (two-letter state code).
 */
export class NormalizeCityNames1710000000062 implements MigrationInterface {
  name = "NormalizeCityNames1710000000062";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create a temporary lookup table for full state name → code
    await queryRunner.query(`
      CREATE TEMPORARY TABLE _state_codes (full_name TEXT, code TEXT);
      INSERT INTO _state_codes (full_name, code) VALUES
        ('alabama','AL'),('alaska','AK'),('arizona','AZ'),('arkansas','AR'),
        ('california','CA'),('colorado','CO'),('connecticut','CT'),('delaware','DE'),
        ('florida','FL'),('georgia','GA'),('hawaii','HI'),('idaho','ID'),
        ('illinois','IL'),('indiana','IN'),('iowa','IA'),('kansas','KS'),
        ('kentucky','KY'),('louisiana','LA'),('maine','ME'),('maryland','MD'),
        ('massachusetts','MA'),('michigan','MI'),('minnesota','MN'),('mississippi','MS'),
        ('missouri','MO'),('montana','MT'),('nebraska','NE'),('nevada','NV'),
        ('new hampshire','NH'),('new jersey','NJ'),('new mexico','NM'),('new york','NY'),
        ('north carolina','NC'),('north dakota','ND'),('ohio','OH'),('oklahoma','OK'),
        ('oregon','OR'),('pennsylvania','PA'),('rhode island','RI'),
        ('south carolina','SC'),('south dakota','SD'),('tennessee','TN'),
        ('texas','TX'),('utah','UT'),('vermont','VT'),('virginia','VA'),
        ('washington','WA'),('west virginia','WV'),('wisconsin','WI'),('wyoming','WY'),
        ('district of columbia','DC'),('puerto rico','PR');
    `);

    // Normalization SQL: title-case city, convert state to 2-letter code
    const tables = ["events", "itineraries", "third_space_score_snapshots"];

    for (const table of tables) {
      // First: convert full state names to codes using the lookup table
      await queryRunner.query(`
        UPDATE ${table} t
        SET city = CONCAT(
          INITCAP(TRIM(SPLIT_PART(t.city, ',', 1))),
          ', ',
          sc.code
        )
        FROM _state_codes sc
        WHERE POSITION(',' IN t.city) > 0
          AND LOWER(TRIM(SPLIT_PART(t.city, ',', 2))) = sc.full_name
          AND t.city IS NOT NULL
          AND t.city != ''
      `);

      // Second: normalize remaining rows (already have short codes or no state match)
      // Title-case city, uppercase state abbreviation
      await queryRunner.query(`
        UPDATE ${table}
        SET city = CONCAT(
          INITCAP(TRIM(SPLIT_PART(city, ',', 1))),
          CASE
            WHEN POSITION(',' IN city) > 0
            THEN ', ' || UPPER(TRIM(SPLIT_PART(city, ',', 2)))
            ELSE ''
          END
        )
        WHERE city IS NOT NULL AND city != ''
      `);
    }

    await queryRunner.query(`DROP TABLE IF EXISTS _state_codes`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // City normalization is not reversible — original casing/format is lost
  }
}
