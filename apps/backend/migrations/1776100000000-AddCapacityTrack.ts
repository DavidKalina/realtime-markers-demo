import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddCapacityTrack1776100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sidequests_capacity_track_enum') THEN CREATE TYPE "public"."sidequests_capacity_track_enum" AS ENUM('ACTIVATION', 'PUBLIC_PRESENCE', 'NOVELTY_TOLERANCE', 'STAYING_POWER', 'RETURNABILITY', 'MICRO_INTERACTION', 'SOCIAL_EXTENSION', 'RECOVERY', 'IDENTITY_EVIDENCE'); END IF; END $$`,
    );
    await queryRunner.query(
      `ALTER TABLE "sidequests" ADD COLUMN IF NOT EXISTS "capacity_track" "public"."sidequests_capacity_track_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sidequests" ADD COLUMN IF NOT EXISTS "rep_intent" character varying(500)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sidequests_capacity_track" ON "sidequests" ("capacity_track")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sidequests_capacity_track"`);
    await queryRunner.query(`ALTER TABLE "sidequests" DROP COLUMN IF EXISTS "rep_intent"`);
    await queryRunner.query(`ALTER TABLE "sidequests" DROP COLUMN IF EXISTS "capacity_track"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."sidequests_capacity_track_enum"`);
  }
}
