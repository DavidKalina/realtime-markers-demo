import { MigrationInterface, QueryRunner } from "typeorm";

export class ItineraryTables1710000000035 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create itinerary status enum
    await queryRunner.query(`
      CREATE TYPE "itinerary_status_enum" AS ENUM ('GENERATING', 'READY', 'FAILED')
    `);

    // Create itineraries table
    await queryRunner.query(`
      CREATE TABLE "itineraries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "city" varchar(255) NOT NULL,
        "planned_date" date NOT NULL,
        "budget_min" numeric(10,2) NOT NULL DEFAULT 0,
        "budget_max" numeric(10,2) NOT NULL DEFAULT 0,
        "duration_hours" numeric(4,1) NOT NULL,
        "activity_types" text[] NOT NULL DEFAULT '{}',
        "title" varchar(500),
        "summary" text,
        "status" "itinerary_status_enum" NOT NULL DEFAULT 'GENERATING',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_itineraries" PRIMARY KEY ("id"),
        CONSTRAINT "FK_itineraries_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_itineraries_user_id" ON "itineraries" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itineraries_city" ON "itineraries" ("city")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_itineraries_created_at" ON "itineraries" ("created_at" DESC)`,
    );

    // Create itinerary_items table
    await queryRunner.query(`
      CREATE TABLE "itinerary_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "itinerary_id" uuid NOT NULL,
        "sort_order" int NOT NULL,
        "start_time" varchar(5) NOT NULL,
        "end_time" varchar(5) NOT NULL,
        "title" varchar(500) NOT NULL,
        "description" text,
        "emoji" varchar(10),
        "estimated_cost" numeric(10,2),
        "venue_name" varchar(500),
        "venue_address" varchar(500),
        "event_id" uuid,
        "travel_note" text,
        CONSTRAINT "PK_itinerary_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_itinerary_items_itinerary" FOREIGN KEY ("itinerary_id")
          REFERENCES "itineraries"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_itinerary_items_event" FOREIGN KEY ("event_id")
          REFERENCES "events"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_itinerary_items_itinerary_id" ON "itinerary_items" ("itinerary_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "itinerary_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "itineraries"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "itinerary_status_enum"`);
  }
}
