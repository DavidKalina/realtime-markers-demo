import type { MigrationInterface, QueryRunner } from "typeorm";

export class DropFollowsAndRituals1710000000061 implements MigrationInterface {
  name = "DropFollowsAndRituals1710000000061";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop follower_count and following_count columns from users table
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "following_count"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "follower_count"`,
    );

    // Drop user_follows table
    await queryRunner.query(`DROP TABLE IF EXISTS "user_follows" CASCADE`);

    // Drop itinerary_rituals table
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_itinerary_rituals_user_id"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "itinerary_rituals" CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-create user_follows table
    await queryRunner.query(`
      CREATE TABLE "user_follows" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "follower_id" uuid NOT NULL,
        "following_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_user_follows" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_follows_followerId_followingId" UNIQUE ("follower_id", "following_id"),
        CONSTRAINT "CHK_user_follows_no_self_follow" CHECK (follower_id != following_id),
        CONSTRAINT "FK_user_follows_follower" FOREIGN KEY ("follower_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_follows_following" FOREIGN KEY ("following_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_user_follows_follower_id" ON "user_follows" ("follower_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_follows_following_id" ON "user_follows" ("following_id")`,
    );

    // Re-add follower/following count columns to users
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "follower_count" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "following_count" integer NOT NULL DEFAULT 0`,
    );

    // Re-create itinerary_rituals table
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
}
