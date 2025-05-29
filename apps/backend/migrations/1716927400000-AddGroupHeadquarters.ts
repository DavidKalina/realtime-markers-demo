import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddGroupHeadquarters1716927400000 implements MigrationInterface {
  name = "AddGroupHeadquarters1716927400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add headquarters columns
    await queryRunner.query(`
            ALTER TABLE "groups" 
            ADD COLUMN "headquarters_place_id" varchar NULL,
            ADD COLUMN "headquarters_name" varchar NULL,
            ADD COLUMN "headquarters_address" text NULL,
            ADD COLUMN "headquarters_location" geometry(Point,4326) NULL
        `);

    // Add indexes for better query performance
    await queryRunner.query(`
            CREATE INDEX "idx_groups_headquarters_place_id" ON "groups" ("headquarters_place_id")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove indexes
    await queryRunner.query(`
            DROP INDEX "idx_groups_headquarters_place_id"
        `);

    // Remove headquarters columns
    await queryRunner.query(`
            ALTER TABLE "groups" 
            DROP COLUMN "headquarters_place_id",
            DROP COLUMN "headquarters_name",
            DROP COLUMN "headquarters_address",
            DROP COLUMN "headquarters_location"
        `);
  }
}
