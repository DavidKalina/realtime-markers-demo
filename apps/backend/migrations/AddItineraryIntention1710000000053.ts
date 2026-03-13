import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddItineraryIntention1710000000053 implements MigrationInterface {
  name = "AddItineraryIntention1710000000053";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE itineraries ADD COLUMN intention varchar(50) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE itineraries DROP COLUMN intention`);
  }
}
