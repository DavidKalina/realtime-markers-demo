import { MigrationInterface, QueryRunner } from "typeorm";

export class DropCivicEngagementTables1710000000023
  implements MigrationInterface
{
  name = "DropCivicEngagementTables1710000000023";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the civic_engagements table if it exists
    await queryRunner.query(`
      DROP TABLE IF EXISTS "civic_engagements" CASCADE
    `);

    // Drop the civic engagement type enum if it exists
    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."civic_engagements_type_enum" CASCADE
    `);

    // Drop the civic engagement status enum if it exists
    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."civic_engagements_status_enum" CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // WARNING: Rolling back this migration re-creates the civic_engagements table in the
    // database, but all application code for civic engagement has been permanently removed.
    // The table will exist with no entity, service, handler, or route backing it.
    // Only revert this migration if you intend to restore civic engagement functionality.
    // Re-create the enums
    await queryRunner.query(`
      CREATE TYPE "public"."civic_engagements_type_enum" AS ENUM (
        'POSITIVE_FEEDBACK',
        'NEGATIVE_FEEDBACK',
        'IDEA'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."civic_engagements_status_enum" AS ENUM (
        'PENDING',
        'UNDER_REVIEW',
        'APPROVED',
        'REJECTED',
        'IMPLEMENTED'
      )
    `);

    // Re-create the civic_engagements table
    await queryRunner.query(`
      CREATE TABLE "civic_engagements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying NOT NULL,
        "description" text,
        "type" "public"."civic_engagements_type_enum" NOT NULL,
        "status" "public"."civic_engagements_status_enum" NOT NULL DEFAULT 'PENDING',
        "location" geometry(Point,4326),
        "address" character varying,
        "location_notes" text,
        "image_urls" text[],
        "creator_id" uuid,
        "admin_notes" text,
        "implemented_at" TIMESTAMP,
        "embedding" vector(1536),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_civic_engagements" PRIMARY KEY ("id")
      )
    `);
  }
}
