import type { MigrationInterface, QueryRunner } from "typeorm";

export class PlannedDateToTimestamptz1710000000064
  implements MigrationInterface
{
  name = "PlannedDateToTimestamptz1710000000064";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE itineraries ALTER COLUMN planned_date TYPE timestamptz USING planned_date::timestamptz`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE itineraries ALTER COLUMN planned_date TYPE date USING planned_date::date`,
    );
  }
}
