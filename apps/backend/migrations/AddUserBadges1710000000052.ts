import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserBadges1710000000052 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_badges" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "badge_id" varchar(50) NOT NULL,
        "progress" integer NOT NULL DEFAULT 0,
        "unlocked_at" timestamptz,
        CONSTRAINT "PK_user_badges" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_badges_user_badge" UNIQUE ("user_id", "badge_id"),
        CONSTRAINT "FK_user_badges_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_badges_user_id" ON "user_badges" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_badges"`);
  }
}
