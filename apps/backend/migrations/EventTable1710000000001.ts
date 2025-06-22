/* eslint-disable quotes */
import { Table, TableForeignKey } from "typeorm";
import type { MigrationInterface, QueryRunner } from "typeorm";

export class EventTable1710000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enums
    await queryRunner.query(
      "CREATE TYPE \"events_status_enum\" AS ENUM('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED', 'CONCLUDED')",
    );
    await queryRunner.query(
      "CREATE TYPE \"events_recurrence_frequency_enum\" AS ENUM('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'YEARLY')",
    );
    await queryRunner.query(
      "CREATE TYPE \"events_recurrence_days_enum\" AS ENUM('SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY')",
    );

    // Create events table
    await queryRunner.createTable(
      new Table({
        name: "events",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          { name: "emoji", type: "varchar", default: "'📍'" },
          { name: "emoji_description", type: "varchar", isNullable: true },
          { name: "title", type: "varchar" },
          { name: "description", type: "text", isNullable: true },
          { name: "event_date", type: "timestamptz" },
          { name: "end_date", type: "timestamptz", isNullable: true },
          {
            name: "timezone",
            type: "varchar",
            isNullable: true,
            default: "'UTC'",
          },
          { name: "address", type: "text", isNullable: true },
          { name: "location_notes", type: "text", isNullable: true },
          { name: "location", type: "geometry(Point, 4326)" },
          { name: "scan_count", type: "integer", default: 1 },
          { name: "save_count", type: "integer", default: 0 },
          { name: "view_count", type: "integer", default: 0 },
          { name: "confidence_score", type: "float", isNullable: true },
          { name: "embedding", type: "text", isNullable: true },
          { name: "status", type: "events_status_enum", default: "'PENDING'" },
          { name: "qr_url", type: "text", isNullable: true },
          { name: "qr_code_data", type: "text", isNullable: true },
          { name: "qr_image_path", type: "text", isNullable: true },
          { name: "has_qr_code", type: "boolean", default: false },
          { name: "is_private", type: "boolean", default: false },
          { name: "qr_generated_at", type: "timestamptz", isNullable: true },
          { name: "qr_detected_in_image", type: "boolean", default: false },
          { name: "detected_qr_data", type: "text", isNullable: true },
          { name: "original_image_url", type: "text", isNullable: true },
          { name: "creator_id", type: "uuid", isNullable: true },
          {
            name: "created_at",
            type: "timestamptz",
            default: "CURRENT_TIMESTAMP",
          },
          {
            name: "updated_at",
            type: "timestamptz",
            default: "CURRENT_TIMESTAMP",
          },
          { name: "is_recurring", type: "boolean", default: false },
          {
            name: "recurrence_frequency",
            type: "events_recurrence_frequency_enum",
            isNullable: true,
          },
          {
            name: "recurrence_days",
            type: "events_recurrence_days_enum",
            isArray: true,
            isNullable: true,
          },
          {
            name: "recurrence_start_date",
            type: "timestamptz",
            isNullable: true,
          },
          {
            name: "recurrence_end_date",
            type: "timestamptz",
            isNullable: true,
          },
          { name: "recurrence_interval", type: "integer", isNullable: true },
          { name: "recurrence_time", type: "time", isNullable: true },
          {
            name: "recurrence_exceptions",
            type: "date",
            isArray: true,
            isNullable: true,
          },
        ],
        indices: [
          { columnNames: ["event_date"] },
          { columnNames: ["end_date"] },
          { columnNames: ["address"] },
          { columnNames: ["creator_id"] },
          { columnNames: ["status"] },
        ],
        foreignKeys: [
          // Temporarily removed foreign key to users table since it doesn't exist yet
          // This will be added in a separate migration after UserTable is created
          // new TableForeignKey({
          //   columnNames: ["creator_id"],
          //   referencedTableName: "users",
          //   referencedColumnNames: ["id"],
          //   onDelete: "SET NULL",
          // }),
        ],
      }),
    );

    // Create event_categories join table
    await queryRunner.createTable(
      new Table({
        name: "event_categories",
        columns: [
          { name: "event_id", type: "uuid", isPrimary: true },
          { name: "category_id", type: "uuid", isPrimary: true },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ["event_id"],
            referencedTableName: "events",
            referencedColumnNames: ["id"],
            onDelete: "CASCADE",
          }),
          new TableForeignKey({
            columnNames: ["category_id"],
            referencedTableName: "categories",
            referencedColumnNames: ["id"],
            onDelete: "CASCADE",
          }),
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("event_categories");
    await queryRunner.dropTable("events");
    await queryRunner.query('DROP TYPE IF EXISTS "events_status_enum"');
    await queryRunner.query(
      'DROP TYPE IF EXISTS "events_recurrence_frequency_enum"',
    );
    await queryRunner.query(
      'DROP TYPE IF EXISTS "events_recurrence_days_enum"',
    );
  }
}
