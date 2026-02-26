import { MigrationInterface, QueryRunner } from "typeorm";

export class EventVibeTagTable1710000000028 implements MigrationInterface {
  name = "EventVibeTagTable1710000000028";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "event_vibe_tag_enum" AS ENUM ('HIDDEN_GEM', 'BRING_FRIENDS', 'GREAT_FOR_SOLO', 'CASH_ONLY', 'OUTDOOR', 'KID_FRIENDLY', 'LOUD', 'CHILL')`,
    );

    await queryRunner.query(
      `CREATE TABLE "event_vibe_tags" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "event_id" uuid NOT NULL,
        "tag" "event_vibe_tag_enum" NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_event_vibe_tags" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_event_vibe_tags_user_event_tag" UNIQUE ("user_id", "event_id", "tag"),
        CONSTRAINT "FK_event_vibe_tags_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_event_vibe_tags_event" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_event_vibe_tags_user_id" ON "event_vibe_tags" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_vibe_tags_event_id" ON "event_vibe_tags" ("event_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "event_vibe_tags"`);
    await queryRunner.query(`DROP TYPE "event_vibe_tag_enum"`);
  }
}
