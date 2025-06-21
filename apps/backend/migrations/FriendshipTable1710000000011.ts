import { Table, TableForeignKey } from "typeorm";
import type { MigrationInterface, QueryRunner } from "typeorm";

export class FriendshipTable1710000000011 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for friendship status
    await queryRunner.query(
      "CREATE TYPE \"friendships_status_enum\" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED')",
    );

    await queryRunner.createTable(
      new Table({
        name: "friendships",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          { name: "requester_id", type: "uuid" },
          { name: "addressee_id", type: "uuid" },
          {
            name: "status",
            type: "friendships_status_enum",
            default: "'PENDING'",
          },
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
        ],
        indices: [
          {
            columnNames: ["requester_id", "addressee_id"],
            isUnique: true,
            name: "IDX_friendships_requesterId_addresseeId",
          },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ["requester_id"],
            referencedTableName: "users",
            referencedColumnNames: ["id"],
            onDelete: "CASCADE",
          }),
          new TableForeignKey({
            columnNames: ["addressee_id"],
            referencedTableName: "users",
            referencedColumnNames: ["id"],
            onDelete: "CASCADE",
          }),
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("friendships");
    await queryRunner.query('DROP TYPE IF EXISTS "friendships_status_enum"');
  }
}
