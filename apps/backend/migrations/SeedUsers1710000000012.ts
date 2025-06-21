import type { MigrationInterface, QueryRunner } from "typeorm";
import bcrypt from "bcrypt";

export class SeedUsers1710000000012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Hash passwords for the seeded users
    const saltRounds = 10;
    const userPasswordHash = await bcrypt.hash("user123", saltRounds);
    const moderatorPasswordHash = await bcrypt.hash("moderator123", saltRounds);
    const adminPasswordHash = await bcrypt.hash("admin123", saltRounds);

    // Insert regular user
    await queryRunner.query(`
      INSERT INTO users (
        id, email, friend_code, password_hash, 
        role, plan_type, is_verified, discovery_count, scan_count, 
        save_count, view_count, weekly_scan_count, created_at, updated_at
      ) VALUES (
        '550e8400-e29b-41d4-a716-446655440001',
        'user@example.com',
        'USER001',
        '${userPasswordHash}',
        'USER',
        'FREE',
        true,
        0,
        0,
        0,
        0,
        0,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      ) ON CONFLICT (email) DO NOTHING
    `);

    // Insert moderator user
    await queryRunner.query(`
      INSERT INTO users (
        id, email, friend_code, password_hash, 
        role, plan_type, is_verified, discovery_count, scan_count, 
        save_count, view_count, weekly_scan_count, created_at, updated_at
      ) VALUES (
        '550e8400-e29b-41d4-a716-446655440002',
        'moderator@example.com',
        'MOD001',
        '${moderatorPasswordHash}',
        'MODERATOR',
        'PRO',
        true,
        0,
        0,
        0,
        0,
        0,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      ) ON CONFLICT (email) DO NOTHING
    `);

    // Insert admin user
    await queryRunner.query(`
      INSERT INTO users (
        id, email, friend_code, password_hash, 
        role, plan_type, is_verified, discovery_count, scan_count, 
        save_count, view_count, weekly_scan_count, created_at, updated_at
      ) VALUES (
        '550e8400-e29b-41d4-a716-446655440003',
        'admin@example.com',
        'ADMIN001',
        '${adminPasswordHash}',
        'ADMIN',
        'PRO',
        true,
        0,
        0,
        0,
        0,
        0,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      ) ON CONFLICT (email) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the seeded users
    await queryRunner.query(`
      DELETE FROM users 
      WHERE email IN (
        'user@example.com',
        'moderator@example.com', 
        'admin@example.com'
      )
    `);
  }
}
