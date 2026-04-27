import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCapabilityProgress1776800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS capability_progress (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        program_id varchar(64) NOT NULL,
        capability_id varchar(128) NOT NULL,
        phase varchar(8) NOT NULL DEFAULT 'bfs',
        active_pattern_id varchar(128),
        patterns_tried text[] NOT NULL DEFAULT '{}',
        pattern_stats jsonb NOT NULL DEFAULT '{}',
        reps_at_current_pattern integer NOT NULL DEFAULT 0,
        avg_resonance numeric(4, 3) NOT NULL DEFAULT 0,
        last_quest_id uuid,
        won_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT capability_progress_user_capability_unique UNIQUE (user_id, capability_id)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS capability_progress_user_id_idx ON capability_progress (user_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS capability_progress`);
  }
}
