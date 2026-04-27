import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPrescriptionTraces1776600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS prescription_traces (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        sidequest_id uuid,
        quest_index integer,
        status varchar(32) NOT NULL DEFAULT 'in_progress',
        error_message text,
        venue_name varchar(255),
        venue_category varchar(100),
        distance_from_home numeric(8, 2),
        capacity_track varchar(50),
        rep_intent varchar(500),
        home_base_viability varchar(20),
        recommended_city varchar(100),
        effective_reach_mode varchar(32),
        started_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz,
        duration_ms integer,
        total_events integer DEFAULT 0,
        total_llm_cost_usd numeric(10, 6) DEFAULT 0
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS prescription_traces_started_at_idx ON prescription_traces (started_at DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS prescription_traces_user_id_idx ON prescription_traces (user_id, started_at DESC)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS trace_events (
        id bigserial PRIMARY KEY,
        trace_id uuid NOT NULL REFERENCES prescription_traces(id) ON DELETE CASCADE,
        sequence integer NOT NULL,
        stage varchar(64) NOT NULL,
        status varchar(16) NOT NULL DEFAULT 'success',
        duration_ms integer,
        input jsonb,
        output jsonb,
        meta jsonb,
        emitted_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT trace_events_trace_seq_unique UNIQUE (trace_id, sequence)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS trace_events_trace_id_seq_idx ON trace_events (trace_id, sequence)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS trace_events`);
    await queryRunner.query(`DROP TABLE IF EXISTS prescription_traces`);
  }
}
