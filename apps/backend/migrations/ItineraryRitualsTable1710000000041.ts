import type { MigrationInterface, QueryRunner } from "typeorm";

export class ItineraryRitualsTable1710000000041 implements MigrationInterface {
  name = "ItineraryRitualsTable1710000000041";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "itinerary_rituals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "emoji" varchar(4) NOT NULL DEFAULT '🔁',
        "budget_min" numeric(10,2) NOT NULL DEFAULT 0,
        "budget_max" numeric(10,2) NOT NULL DEFAULT 0,
        "duration_hours" numeric(4,1) NOT NULL,
        "activity_types" text[] NOT NULL DEFAULT '{}',
        "stop_count" int NOT NULL DEFAULT 0,
        "category_names" text[] NOT NULL DEFAULT '{}',
        "usage_count" int NOT NULL DEFAULT 0,
        "last_used_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_itinerary_rituals" PRIMARY KEY ("id"),
        CONSTRAINT "FK_itinerary_rituals_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_itinerary_rituals_user_id" ON "itinerary_rituals" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "itinerary_rituals"`);
  }
}
