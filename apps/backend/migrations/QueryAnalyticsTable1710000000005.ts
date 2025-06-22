import { Table } from "typeorm";
import type { MigrationInterface, QueryRunner } from "typeorm";

export class QueryAnalyticsTable1710000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "query_analytics",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          { name: "query", type: "text" },
          { name: "normalized_query", type: "text" },
          { name: "total_searches", type: "integer", default: 0 },
          { name: "total_hits", type: "integer", default: 0 },
          { name: "zero_result_searches", type: "integer", default: 0 },
          { name: "average_results_per_search", type: "float", default: 0 },
          { name: "hit_rate", type: "float", default: 0 },
          { name: "first_searched_at", type: "timestamp", isNullable: true },
          { name: "last_searched_at", type: "timestamp", isNullable: true },
          { name: "top_results", type: "jsonb", isNullable: true },
          { name: "search_categories", type: "jsonb", isNullable: true },
          { name: "is_popular", type: "boolean", default: false },
          { name: "needs_attention", type: "boolean", default: false },
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
          { columnNames: ["query"] },
          { columnNames: ["normalized_query"] },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("query_analytics");
  }
}
