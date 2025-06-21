import { Table } from "typeorm";
import type { MigrationInterface, QueryRunner } from "typeorm";

export class FilterTable1710000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "filters",
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
          { name: "name", type: "varchar" },
          { name: "is_active", type: "boolean", default: true },
          { name: "semantic_query", type: "text", isNullable: true },
          { name: "embedding", type: "text", isNullable: true },
          { name: "emoji", type: "varchar", isNullable: true },
          { name: "criteria", type: "jsonb" },
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
        indices: [{ columnNames: ["user_id"] }, { columnNames: ["is_active"] }],
        foreignKeys: [
          // Temporarily removed foreign key to users table since it doesn't exist yet
          // This will be added in a separate migration after UserTable is created
          // new TableForeignKey({
          //   columnNames: ["user_id"],
          //   referencedTableName: "users",
          //   referencedColumnNames: ["id"],
          //   onDelete: "CASCADE",
          // }),
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("filters");
  }
}
