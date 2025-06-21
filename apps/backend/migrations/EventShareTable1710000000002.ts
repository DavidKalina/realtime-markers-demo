import { Table, TableForeignKey } from "typeorm";
import type { MigrationInterface, QueryRunner } from "typeorm";

export class EventShareTable1710000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "event_shares",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          { name: "event_id", type: "uuid" },
          { name: "shared_with_id", type: "uuid" },
          { name: "shared_by_id", type: "uuid" },
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
          {
            columnNames: ["event_id", "shared_with_id"],
            isUnique: true,
            name: "IDX_event_shares_eventId_sharedWithId",
          },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ["event_id"],
            referencedTableName: "events",
            referencedColumnNames: ["id"],
            onDelete: "CASCADE",
          }),
          // Temporarily removed foreign keys to users table since it doesn't exist yet
          // These will be added in separate migrations after UserTable is created
          // new TableForeignKey({
          //   columnNames: ["shared_with_id"],
          //   referencedTableName: "users",
          //   referencedColumnNames: ["id"],
          //   onDelete: "CASCADE",
          // }),
          // new TableForeignKey({
          //   columnNames: ["shared_by_id"],
          //   referencedTableName: "users",
          //   referencedColumnNames: ["id"],
          //   onDelete: "CASCADE",
          // }),
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("event_shares");
  }
}
