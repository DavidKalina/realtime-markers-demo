import { Table, TableForeignKey, TableCheck } from "typeorm";
import type { MigrationInterface, QueryRunner } from "typeorm";

export class UserFollowTable1710000000030 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "user_follows",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          { name: "follower_id", type: "uuid" },
          { name: "following_id", type: "uuid" },
          {
            name: "created_at",
            type: "timestamptz",
            default: "CURRENT_TIMESTAMP",
          },
        ],
        indices: [
          { columnNames: ["follower_id"] },
          { columnNames: ["following_id"] },
        ],
        uniques: [
          {
            columnNames: ["follower_id", "following_id"],
            name: "UQ_user_follows_followerId_followingId",
          },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ["follower_id"],
            referencedTableName: "users",
            referencedColumnNames: ["id"],
            onDelete: "CASCADE",
          }),
          new TableForeignKey({
            columnNames: ["following_id"],
            referencedTableName: "users",
            referencedColumnNames: ["id"],
            onDelete: "CASCADE",
          }),
        ],
        checks: [
          new TableCheck({
            name: "CHK_user_follows_no_self_follow",
            expression: "follower_id != following_id",
          }),
        ],
      }),
    );

    // Add follower_count and following_count columns to users table
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "follower_count" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "following_count" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "following_count"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "follower_count"`);
    await queryRunner.dropTable("user_follows");
  }
}
