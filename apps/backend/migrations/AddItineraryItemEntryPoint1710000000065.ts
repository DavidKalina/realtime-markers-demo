import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddItineraryItemEntryPoint1710000000065
  implements MigrationInterface
{
  name = "AddItineraryItemEntryPoint1710000000065";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE itinerary_items
       ADD COLUMN entry_latitude numeric(10,7),
       ADD COLUMN entry_longitude numeric(10,7),
       ADD COLUMN entry_point_name varchar(500)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE itinerary_items
       DROP COLUMN IF EXISTS entry_latitude,
       DROP COLUMN IF EXISTS entry_longitude,
       DROP COLUMN IF EXISTS entry_point_name`,
    );
  }
}
