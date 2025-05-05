import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmojiTable1710000000004 implements MigrationInterface {
  name = "AddEmojiTable1710000000004";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "emoji" (
                "id" SERIAL NOT NULL,
                "emoji" character varying NOT NULL,
                "name" character varying NOT NULL,
                "category_id" uuid,
                "keywords" text[] NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "rank" integer,
                CONSTRAINT "PK_emoji" PRIMARY KEY ("id"),
                CONSTRAINT "FK_emoji_category" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL
            )
        `);

    // Add indexes for faster searches
    await queryRunner.query(`
            CREATE INDEX "IDX_emoji_name" ON "emoji" ("name");
            CREATE INDEX "IDX_emoji_keywords" ON "emoji" USING GIN ("keywords");
            CREATE INDEX "IDX_emoji_category" ON "emoji" ("category_id");
            CREATE INDEX "IDX_emoji_rank" ON "emoji" ("rank");
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_emoji_rank"`);
    await queryRunner.query(`DROP INDEX "IDX_emoji_category"`);
    await queryRunner.query(`DROP INDEX "IDX_emoji_keywords"`);
    await queryRunner.query(`DROP INDEX "IDX_emoji_name"`);
    await queryRunner.query(`DROP TABLE "emoji"`);
  }
}
