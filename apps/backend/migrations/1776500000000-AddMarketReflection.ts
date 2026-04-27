import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMarketReflection1776500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE sidequests ADD COLUMN IF NOT EXISTS market_reflection TEXT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE sidequests DROP COLUMN IF EXISTS market_reflection`,
    );
  }
}
