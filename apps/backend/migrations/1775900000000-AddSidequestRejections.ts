import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddSidequestRejections1775900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sidequest_rejections_reason_enum') THEN CREATE TYPE "public"."sidequest_rejections_reason_enum" AS ENUM('TOO_SOCIAL', 'TOO_FAR', 'TOO_PUBLIC', 'TOO_MUCH_EFFORT', 'NOT_MY_VIBE', 'BAD_TIMING', 'NEED_GENTLER'); END IF; END $$`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "sidequest_rejections" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sidequest_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "reason" "public"."sidequest_rejections_reason_enum" NOT NULL,
        "venue_name" character varying(255),
        "venue_category" character varying(100),
        "note" text,
        "rejected_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sidequest_rejections_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sidequest_rejections_sidequest" FOREIGN KEY ("sidequest_id") REFERENCES "sidequests"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_sidequest_rejections_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sidequest_rejections_sidequest_id" ON "sidequest_rejections" ("sidequest_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sidequest_rejections_user_id" ON "sidequest_rejections" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sidequest_rejections_rejected_at" ON "sidequest_rejections" ("rejected_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sidequest_rejections"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."sidequest_rejections_reason_enum"`);
  }
}
