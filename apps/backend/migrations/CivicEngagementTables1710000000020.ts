import {
  type MigrationInterface,
  type QueryRunner,
  Table,
  TableForeignKey,
} from "typeorm";

export class CivicEngagementTables1710000000020 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enums
    await queryRunner.query(`
      CREATE TYPE "civic_engagement_type_enum" AS ENUM(
        'POSITIVE_FEEDBACK', 'NEGATIVE_FEEDBACK', 'IDEA'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "civic_engagement_status_enum" AS ENUM(
        'PENDING', 'IN_REVIEW', 'IMPLEMENTED', 'CLOSED'
      )
    `);

    // Create civic_engagements table
    await queryRunner.createTable(
      new Table({
        name: "civic_engagements",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          { name: "creator_id", type: "uuid" },
          { name: "title", type: "varchar" },
          { name: "description", type: "text", isNullable: true },
          { name: "type", type: "civic_engagement_type_enum" },
          {
            name: "status",
            type: "civic_engagement_status_enum",
            default: "'PENDING'",
          },
          { name: "location", type: "geometry(Point, 4326)", isNullable: true },
          { name: "address", type: "text", isNullable: true },
          { name: "location_notes", type: "text", isNullable: true },
          { name: "image_urls", type: "jsonb", isNullable: true },
          { name: "admin_notes", type: "text", isNullable: true },
          { name: "implemented_at", type: "timestamptz", isNullable: true },
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
          { columnNames: ["creator_id"] },
          { columnNames: ["type"] },
          { columnNames: ["status"] },
          { columnNames: ["created_at"] },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ["creator_id"],
            referencedTableName: "users",
            referencedColumnNames: ["id"],
            onDelete: "CASCADE",
          }),
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("civic_engagements");
    await queryRunner.query("DROP TYPE civic_engagement_status_enum");
    await queryRunner.query("DROP TYPE civic_engagement_type_enum");
  }
}
