/* eslint-disable quotes */
import { Table } from "typeorm";
import type { MigrationInterface, QueryRunner } from "typeorm";

export class NotificationTable1710000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for notification type
    await queryRunner.query(
      "CREATE TYPE \"notifications_type_enum\" AS ENUM('EVENT_CREATED', 'EVENT_UPDATED', 'EVENT_DELETED', 'EVENT_RSVP_TOGGLED', 'FRIEND_REQUEST', 'FRIEND_ACCEPTED', 'LEVEL_UP', 'ACHIEVEMENT_UNLOCKED', 'SYSTEM')",
    );

    await queryRunner.createTable(
      new Table({
        name: "notifications",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          { name: "type", type: "notifications_type_enum" },
          { name: "userId", type: "uuid" },
          { name: "title", type: "varchar" },
          { name: "message", type: "text" },
          { name: "data", type: "jsonb", isNullable: true },
          {
            name: "createdAt",
            type: "timestamptz",
            default: "CURRENT_TIMESTAMP",
          },
          { name: "read", type: "boolean", default: false },
          { name: "readAt", type: "timestamptz", isNullable: true },
        ],
        foreignKeys: [
          // Temporarily removed foreign key to users table since it doesn't exist yet
          // This will be added in a separate migration after UserTable is created
          // new TableForeignKey({
          //   columnNames: ["userId"],
          //   referencedTableName: "users",
          //   referencedColumnNames: ["id"],
          // }),
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("notifications");
    await queryRunner.query('DROP TYPE IF EXISTS "notifications_type_enum"');
  }
}
