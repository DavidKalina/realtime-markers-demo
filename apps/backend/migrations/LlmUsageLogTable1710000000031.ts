import { Table } from "typeorm";
import type { MigrationInterface, QueryRunner } from "typeorm";

export class LlmUsageLogTable1710000000031 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "llm_usage_logs",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          { name: "model", type: "varchar" },
          { name: "operation", type: "varchar" },
          { name: "caller", type: "varchar" },
          { name: "prompt_tokens", type: "integer" },
          { name: "completion_tokens", type: "integer" },
          { name: "total_tokens", type: "integer" },
          { name: "estimated_cost", type: "decimal", precision: 10, scale: 6 },
          { name: "duration_ms", type: "integer" },
          {
            name: "created_at",
            type: "timestamptz",
            default: "CURRENT_TIMESTAMP",
          },
        ],
        indices: [{ columnNames: ["created_at"] }, { columnNames: ["model"] }],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("llm_usage_logs");
  }
}
