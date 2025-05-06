import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateNotificationsTable1710000000009 implements MigrationInterface {
  name = "CreateNotificationsTable1710000000009";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TYPE "public"."notifications_type_enum" AS ENUM(
                'EVENT_CREATED',
                'EVENT_UPDATED',
                'EVENT_DELETED',
                'FRIEND_REQUEST',
                'FRIEND_ACCEPTED',
                'LEVEL_UP',
                'ACHIEVEMENT_UNLOCKED',
                'SYSTEM'
            )
        `);

    await queryRunner.query(`
            CREATE TABLE "notifications" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "type" "public"."notifications_type_enum" NOT NULL,
                "userId" uuid NOT NULL,
                "title" character varying NOT NULL,
                "message" text NOT NULL,
                "data" jsonb,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "read" boolean NOT NULL DEFAULT false,
                "readAt" TIMESTAMP,
                CONSTRAINT "PK_notifications" PRIMARY KEY ("id")
            )
        `);

    await queryRunner.query(`
            ALTER TABLE "notifications"
            ADD CONSTRAINT "FK_notifications_user"
            FOREIGN KEY ("userId")
            REFERENCES "users"("id")
            ON DELETE CASCADE
            ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_notifications_user"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
  }
}
