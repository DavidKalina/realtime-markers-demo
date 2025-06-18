import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddViewTracking1710000000012 implements MigrationInterface {
  name = "AddViewTracking1710000000012";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add viewCount column to users table
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN "view_count" integer NOT NULL DEFAULT 0
    `);

    // Add viewCount column to events table
    await queryRunner.query(`
      ALTER TABLE "events" 
      ADD COLUMN "view_count" integer NOT NULL DEFAULT 0
    `);

    // Create user_event_views table
    await queryRunner.query(`
      CREATE TABLE "user_event_views" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "event_id" uuid NOT NULL,
        "viewed_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_event_views" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_event_views_user_event" UNIQUE ("user_id", "event_id")
      )
    `);

    // Create indexes for performance
    await queryRunner.query(`
      CREATE INDEX "IDX_user_event_views_user_id" ON "user_event_views" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_event_views_event_id" ON "user_event_views" ("event_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_event_views_viewed_at" ON "user_event_views" ("user_id", "viewed_at")
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "user_event_views" 
      ADD CONSTRAINT "FK_user_event_views_user" 
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "user_event_views" 
      ADD CONSTRAINT "FK_user_event_views_event" 
      FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "user_event_views" 
      DROP CONSTRAINT "FK_user_event_views_event"
    `);

    await queryRunner.query(`
      ALTER TABLE "user_event_views" 
      DROP CONSTRAINT "FK_user_event_views_user"
    `);

    // Drop indexes
    await queryRunner.query(`
      DROP INDEX "IDX_user_event_views_viewed_at"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_user_event_views_event_id"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_user_event_views_user_id"
    `);

    // Drop user_event_views table
    await queryRunner.query(`
      DROP TABLE "user_event_views"
    `);

    // Remove viewCount columns
    await queryRunner.query(`
      ALTER TABLE "events" 
      DROP COLUMN "view_count"
    `);

    await queryRunner.query(`
      ALTER TABLE "users" 
      DROP COLUMN "view_count"
    `);
  }
}
