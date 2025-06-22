import { Table, TableForeignKey } from "typeorm";
import type { MigrationInterface, QueryRunner } from "typeorm";

export class UserEventDiscoveryTable1710000000007
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "user_event_discoveries",
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
            name: "discovered_at",
            type: "timestamptz",
            default: "CURRENT_TIMESTAMP",
          },
        ],
        indices: [
          {
            columnNames: ["user_id", "event_id"],
            isUnique: true,
            name: "IDX_user_event_discoveries_userId_eventId",
          },
          {
            columnNames: ["user_id", "discovered_at"],
            name: "IDX_user_event_discoveries_userId_discoveredAt",
          },
          {
            columnNames: ["discovered_at"],
            name: "IDX_user_event_discoveries_discoveredAt",
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
    await queryRunner.dropTable("user_event_discoveries");
  }
}
