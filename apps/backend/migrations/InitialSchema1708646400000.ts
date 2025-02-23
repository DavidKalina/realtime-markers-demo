import { type MigrationInterface, type QueryRunner } from "typeorm";

export class InitialSchema1708646400000 implements MigrationInterface {
  name = "InitialSchema1708646400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create UUID extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create Event Status enum
    await queryRunner.query(`
            CREATE TYPE event_status AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED')
        `);

    // Create Third Space Status enum
    await queryRunner.query(`
            CREATE TYPE third_space_status AS ENUM ('bronze', 'silver', 'gold', 'platinum')
        `);

    // Create Category table
    await queryRunner.query(`
            CREATE TABLE "categories" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "name" varchar NOT NULL UNIQUE,
                "description" text,
                "icon" varchar,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now()
            )
        `);

    // Create Third Space table
    await queryRunner.query(`
            CREATE TABLE "third_spaces" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "name" varchar NOT NULL,
                "location" geometry(Point, 4326) NOT NULL,
                "status" third_space_status,
                "event_count" integer NOT NULL DEFAULT 0,
                "diversity_score" float,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now()
            )
        `);

    // Create Events table
    await queryRunner.query(`
            CREATE TABLE "events" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "title" varchar NOT NULL,
                "description" text,
                "event_date" timestamptz NOT NULL,
                "address" text,
                "location" geometry(Point, 4326) NOT NULL,
                "scan_count" integer NOT NULL DEFAULT 1,
                "confidence_score" float,
                "embedding" text,
                "status" event_status NOT NULL DEFAULT 'PENDING',
                "thirdSpaceId" uuid,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "fk_event_third_space" FOREIGN KEY ("thirdSpaceId") 
                    REFERENCES "third_spaces"("id") ON DELETE SET NULL
            )
        `);

    // Create Event-Category join table
    await queryRunner.query(`
            CREATE TABLE "event_categories" (
                "event_id" uuid REFERENCES "events"("id") ON DELETE CASCADE,
                "category_id" uuid REFERENCES "categories"("id") ON DELETE CASCADE,
                PRIMARY KEY ("event_id", "category_id")
            )
        `);

    // Create seed tracking table
    await queryRunner.query(`
            CREATE TABLE "seed_status" (
                "seed_name" varchar PRIMARY KEY,
                "completed" boolean NOT NULL DEFAULT false,
                "timestamp" timestamptz NOT NULL DEFAULT now()
            )
        `);

    // Create indexes for spatial queries
    await queryRunner.query(`
            CREATE INDEX "idx_events_location" ON "events" USING GIST ("location");
            CREATE INDEX "idx_third_spaces_location" ON "third_spaces" USING GIST ("location");
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_events_location"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_third_spaces_location"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "event_categories"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "third_spaces"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "categories"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "seed_status"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS event_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS third_space_status`);
  }
}
