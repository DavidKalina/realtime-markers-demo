import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddEventRsvpToggledNotificationType1710000000010
  implements MigrationInterface
{
  name = "AddEventRsvpToggledNotificationType1710000000010";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "public"."notifications_type_enum" ADD VALUE 'EVENT_RSVP_TOGGLED'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL doesn't support removing enum values directly
    // We would need to create a new type without the value and replace the old one
    // This is a complex operation that could affect existing data
    // For safety, we'll leave this empty
  }
}
