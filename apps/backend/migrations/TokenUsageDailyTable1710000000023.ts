import { MigrationInterface, QueryRunner, Table, TableIndex, TableUnique } from "typeorm";

export class TokenUsageDailyTable1710000000023 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "token_usage_daily",
        columns: [
          { name: "id", type: "uuid", isPrimary: true, generationStrategy: "uuid", default: "uuid_generate_v4()" },
          { name: "usage_date", type: "date", isNullable: false },
          { name: "model", type: "text", isNullable: false },
          { name: "operation", type: "text", isNullable: false },
          { name: "scope", type: "text", isNullable: false },
          { name: "prompt_tokens", type: "integer", isNullable: false, default: 0 },
          { name: "completion_tokens", type: "integer", isNullable: false, default: 0 },
          { name: "total_tokens", type: "integer", isNullable: false, default: 0 },
          { name: "created_at", type: "timestamptz", default: "now()" },
          { name: "updated_at", type: "timestamptz", default: "now()" },
        ],
      }),
    );

    await queryRunner.createIndex(
      "token_usage_daily",
      new TableIndex({
        name: "idx_token_usage_daily_usage_date",
        columnNames: ["usage_date"],
      }),
    );

    await queryRunner.createIndex(
      "token_usage_daily",
      new TableIndex({
        name: "idx_token_usage_daily_model",
        columnNames: ["model"],
      }),
    );

    await queryRunner.createIndex(
      "token_usage_daily",
      new TableIndex({
        name: "idx_token_usage_daily_operation",
        columnNames: ["operation"],
      }),
    );

    await queryRunner.createIndex(
      "token_usage_daily",
      new TableIndex({
        name: "idx_token_usage_daily_scope",
        columnNames: ["scope"],
      }),
    );

    await queryRunner.createUniqueConstraint(
      "token_usage_daily",
      new TableUnique({
        name: "uq_token_usage_daily_key",
        columnNames: ["usage_date", "model", "operation", "scope"],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropUniqueConstraint(
      "token_usage_daily",
      "uq_token_usage_daily_key",
    );
    await queryRunner.dropIndex("token_usage_daily", "idx_token_usage_daily_scope");
    await queryRunner.dropIndex("token_usage_daily", "idx_token_usage_daily_operation");
    await queryRunner.dropIndex("token_usage_daily", "idx_token_usage_daily_model");
    await queryRunner.dropIndex("token_usage_daily", "idx_token_usage_daily_usage_date");
    await queryRunner.dropTable("token_usage_daily");
  }
}

