import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddRecurringEventFields1710000000011
  implements MigrationInterface
{
  name = "AddRecurringEventFields1710000000011";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add is_recurring column
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN "is_recurring" boolean NOT NULL DEFAULT false
    `);

    // Add recurrence_frequency column as enum
    await queryRunner.query(`
      CREATE TYPE "recurrence_frequency_enum" AS ENUM (
        'DAILY',
        'WEEKLY',
        'BIWEEKLY',
        'MONTHLY',
        'YEARLY'
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN "recurrence_frequency" "recurrence_frequency_enum"
    `);

    // Add recurrence_days column as enum array
    await queryRunner.query(`
      CREATE TYPE "day_of_week_enum" AS ENUM (
        'SUNDAY',
        'MONDAY',
        'TUESDAY',
        'WEDNESDAY',
        'THURSDAY',
        'FRIDAY',
        'SATURDAY'
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN "recurrence_days" "day_of_week_enum"[] DEFAULT NULL
    `);

    // Add recurrence_start_date column
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN "recurrence_start_date" timestamptz
    `);

    // Add recurrence_end_date column
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN "recurrence_end_date" timestamptz
    `);

    // Add recurrence_interval column
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN "recurrence_interval" integer
    `);

    // Add recurrence_time column
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN "recurrence_time" time
    `);

    // Add recurrence_exceptions column as date array
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN "recurrence_exceptions" date[] DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove recurrence_exceptions column
    await queryRunner.query(`
      ALTER TABLE "events"
      DROP COLUMN "recurrence_exceptions"
    `);

    // Remove recurrence_time column
    await queryRunner.query(`
      ALTER TABLE "events"
      DROP COLUMN "recurrence_time"
    `);

    // Remove recurrence_interval column
    await queryRunner.query(`
      ALTER TABLE "events"
      DROP COLUMN "recurrence_interval"
    `);

    // Remove recurrence_end_date column
    await queryRunner.query(`
      ALTER TABLE "events"
      DROP COLUMN "recurrence_end_date"
    `);

    // Remove recurrence_start_date column
    await queryRunner.query(`
      ALTER TABLE "events"
      DROP COLUMN "recurrence_start_date"
    `);

    // Remove recurrence_days column and its enum type
    await queryRunner.query(`
      ALTER TABLE "events"
      DROP COLUMN "recurrence_days"
    `);

    await queryRunner.query(`
      DROP TYPE "day_of_week_enum"
    `);

    // Remove recurrence_frequency column and its enum type
    await queryRunner.query(`
      ALTER TABLE "events"
      DROP COLUMN "recurrence_frequency"
    `);

    await queryRunner.query(`
      DROP TYPE "recurrence_frequency_enum"
    `);

    // Remove is_recurring column
    await queryRunner.query(`
      ALTER TABLE "events"
      DROP COLUMN "is_recurring"
    `);
  }
}
