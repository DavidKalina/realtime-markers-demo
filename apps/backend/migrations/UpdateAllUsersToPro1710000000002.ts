import type { MigrationInterface, QueryRunner } from "typeorm";
import { PlanType } from "../entities/User";

export class UpdateAllUsersToPro1710000000002 implements MigrationInterface {
  name = "UpdateAllUsersToPro1710000000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            UPDATE users
            SET plan_type = '${PlanType.PRO}'
            WHERE plan_type = '${PlanType.FREE}'
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            UPDATE users
            SET plan_type = '${PlanType.FREE}'
            WHERE plan_type = '${PlanType.PRO}'
        `);
  }
}
