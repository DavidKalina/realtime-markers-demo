import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddItineraryItemEmbeddingsAndCategories1710000000058 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add embedding column to itinerary_items
    await queryRunner.query(
      `ALTER TABLE "itinerary_items" ADD COLUMN IF NOT EXISTS "embedding" text`,
    );

    // Create join table for itinerary_item <-> category M2M
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "itinerary_item_categories" (
        "itinerary_item_id" uuid NOT NULL REFERENCES "itinerary_items"("id") ON DELETE CASCADE,
        "category_id" uuid NOT NULL REFERENCES "categories"("id") ON DELETE CASCADE,
        PRIMARY KEY ("itinerary_item_id", "category_id")
      )
    `);

    // Index for querying categories by item and items by category
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itinerary_item_categories_item" ON "itinerary_item_categories" ("itinerary_item_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_itinerary_item_categories_category" ON "itinerary_item_categories" ("category_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_itinerary_item_categories_category"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_itinerary_item_categories_item"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "itinerary_item_categories"`);
    await queryRunner.query(
      `ALTER TABLE "itinerary_items" DROP COLUMN IF EXISTS "embedding"`,
    );
  }
}
