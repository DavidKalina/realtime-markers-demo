import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Drop fully-dead discovery/scan/save/view counters on the users table.
 * These columns were write-only echoes in the login + admin response —
 * nothing in application code ever incremented them. See PRODUCT_DESIGN.md
 * ("Drops" list: scan_count, discovery_count, weekly_scan_count, currentTier).
 *
 * Streak columns (current_streak, longest_streak, last_streak_week) are
 * still actively written on every check-in and drive the mobile UI, so
 * they stay. Same for total_xp / current_tier until the gamification UI
 * is retired in a follow-up.
 */
export class DropDeadScanColumns1776200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "discovery_count"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "scan_count"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "save_count"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "view_count"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "weekly_scan_count"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "last_scan_reset"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "discovery_count" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "scan_count" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "save_count" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "view_count" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "weekly_scan_count" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_scan_reset" timestamptz`);
  }
}
