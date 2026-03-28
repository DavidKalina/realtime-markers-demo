import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Baseline migration — marks the current schema as the starting point.
 * All tables already exist from the previous synchronize: true era.
 * Future migrations build on top of this.
 */
export class Baseline1711700000000 implements MigrationInterface {
  public async up(_queryRunner: QueryRunner): Promise<void> {
    // No-op: current schema is the baseline
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No-op: cannot roll back to before the baseline
  }
}
