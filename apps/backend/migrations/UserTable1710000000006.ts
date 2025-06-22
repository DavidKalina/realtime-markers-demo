import { Table } from "typeorm";
import type { MigrationInterface, QueryRunner } from "typeorm";

export class UserTable1710000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enums
    await queryRunner.query(
      "CREATE TYPE \"users_role_enum\" AS ENUM('USER', 'MODERATOR', 'ADMIN')",
    );

    await queryRunner.createTable(
      new Table({
        name: "users",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          { name: "email", type: "varchar", isUnique: true },
          { name: "first_name", type: "varchar", isNullable: true },
          { name: "last_name", type: "varchar", isNullable: true },
          {
            name: "friend_code",
            type: "varchar",
            isUnique: true,
            isNullable: true,
          },
          { name: "phone", type: "varchar", isNullable: true },
          { name: "password_hash", type: "varchar" },
          { name: "avatar_url", type: "varchar", isNullable: true },
          { name: "bio", type: "text", isNullable: true },
          { name: "role", type: "users_role_enum", default: "'USER'" },
          { name: "is_verified", type: "boolean", default: false },
          { name: "discovery_count", type: "integer", default: 0 },
          { name: "scan_count", type: "integer", default: 0 },
          { name: "save_count", type: "integer", default: 0 },
          { name: "view_count", type: "integer", default: 0 },
          { name: "weekly_scan_count", type: "integer", default: 0 },
          { name: "last_scan_reset", type: "timestamptz", isNullable: true },
          { name: "contacts", type: "jsonb", isNullable: true },
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
          { name: "refresh_token", type: "varchar", isNullable: true },
        ],
        indices: [
          { columnNames: ["email"], isUnique: true },
          { columnNames: ["friend_code"], isUnique: true },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("users");
    await queryRunner.query('DROP TYPE IF EXISTS "users_role_enum"');
  }
}
