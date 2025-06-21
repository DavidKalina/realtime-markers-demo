import { Table, TableForeignKey } from "typeorm";
import type { MigrationInterface, QueryRunner } from "typeorm";

export class UserEventViewTable1710000000010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "user_event_views",
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
            name: "viewed_at",
            type: "timestamptz",
            default: "CURRENT_TIMESTAMP",
          },
        ],
        indices: [
          { columnNames: ["user_id"] },
          {
            columnNames: ["user_id", "viewed_at"],
            name: "IDX_user_event_views_userId_viewedAt",
          },
        ],
        uniques: [
          {
            columnNames: ["user_id", "event_id"],
            name: "UQ_user_event_views_userId_eventId",
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
    await queryRunner.dropTable("user_event_views");
  }
}
