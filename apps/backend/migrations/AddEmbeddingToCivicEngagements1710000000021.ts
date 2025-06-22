import { type MigrationInterface, type QueryRunner } from "typeorm";

export class AddEmbeddingToCivicEngagements1710000000021
  implements MigrationInterface
{
  name = "AddEmbeddingToCivicEngagements1710000000021";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add embedding column to civic_engagements table
    await queryRunner.query(`
      ALTER TABLE "civic_engagements" 
      ADD COLUMN "embedding" text
    `);

    console.log("✅ Added embedding column to civic_engagements table");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove embedding column from civic_engagements table
    await queryRunner.query(`
      ALTER TABLE "civic_engagements" 
      DROP COLUMN "embedding"
    `);

    console.log("✅ Removed embedding column from civic_engagements table");
  }
}
