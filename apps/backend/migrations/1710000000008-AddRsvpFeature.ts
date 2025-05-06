import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddRsvpFeature1710000000008 implements MigrationInterface {
  name = "AddRsvpFeature1710000000008";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the RSVP status enum type
    await queryRunner.query(`
            CREATE TYPE "public"."rsvp_status_enum" AS ENUM('GOING', 'NOT_GOING')
        `);

    // Create the user_event_rsvps table
    await queryRunner.query(`
            CREATE TABLE "user_event_rsvps" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "event_id" uuid NOT NULL,
                "status" "public"."rsvp_status_enum" NOT NULL DEFAULT 'GOING',
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_user_event_rsvps" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_user_event_rsvps_user_event" UNIQUE ("user_id", "event_id")
            )
        `);

    // Add indexes
    await queryRunner.query(`
            CREATE INDEX "IDX_user_event_rsvps_user_id" ON "user_event_rsvps" ("user_id")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_user_event_rsvps_event_id" ON "user_event_rsvps" ("event_id")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_user_event_rsvps_user_created" ON "user_event_rsvps" ("user_id", "created_at")
        `);

    // Add foreign key constraints
    await queryRunner.query(`
            ALTER TABLE "user_event_rsvps"
            ADD CONSTRAINT "FK_user_event_rsvps_user"
            FOREIGN KEY ("user_id")
            REFERENCES "users"("id")
            ON DELETE CASCADE
        `);

    await queryRunner.query(`
            ALTER TABLE "user_event_rsvps"
            ADD CONSTRAINT "FK_user_event_rsvps_event"
            FOREIGN KEY ("event_id")
            REFERENCES "events"("id")
            ON DELETE CASCADE
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign key constraints
    await queryRunner.query(`
            ALTER TABLE "user_event_rsvps"
            DROP CONSTRAINT "FK_user_event_rsvps_user"
        `);

    await queryRunner.query(`
            ALTER TABLE "user_event_rsvps"
            DROP CONSTRAINT "FK_user_event_rsvps_event"
        `);

    // Drop indexes
    await queryRunner.query(`
            DROP INDEX "IDX_user_event_rsvps_user_created"
        `);
    await queryRunner.query(`
            DROP INDEX "IDX_user_event_rsvps_event_id"
        `);
    await queryRunner.query(`
            DROP INDEX "IDX_user_event_rsvps_user_id"
        `);

    // Drop the table
    await queryRunner.query(`
            DROP TABLE "user_event_rsvps"
        `);

    // Drop the enum type
    await queryRunner.query(`
            DROP TYPE "public"."rsvp_status_enum"
        `);
  }
}
