import { Table, TableForeignKey } from "typeorm";
import type { MigrationInterface, QueryRunner } from "typeorm";

export class UserEventRsvpTable1710000000008 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for RSVP status
    await queryRunner.query(
      "CREATE TYPE \"user_event_rsvps_status_enum\" AS ENUM('GOING', 'NOT_GOING')",
    );

    await queryRunner.createTable(
      new Table({
        name: "user_event_rsvps",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          { name: "user_id", type: "uuid" },
          { name: "event_id", type: "uuid" },
          {
            name: "status",
            type: "user_event_rsvps_status_enum",
            default: "'GOING'",
          },
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
        ],
        indices: [
          { columnNames: ["user_id"] },
          {
            columnNames: ["user_id", "created_at"],
            name: "IDX_user_event_rsvps_userId_createdAt",
          },
        ],
        uniques: [
          {
            columnNames: ["user_id", "event_id"],
            name: "UQ_user_event_rsvps_userId_eventId",
          },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ["user_id"],
            referencedTableName: "users",
            referencedColumnNames: ["id"],
            onDelete: "CASCADE",
          }),
          new TableForeignKey({
            columnNames: ["event_id"],
            referencedTableName: "events",
            referencedColumnNames: ["id"],
            onDelete: "CASCADE",
          }),
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("user_event_rsvps");
    await queryRunner.query(
      'DROP TYPE IF EXISTS "user_event_rsvps_status_enum"',
    );
  }
}
