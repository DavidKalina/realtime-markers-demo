import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddGroupsFeature1710000000011 implements MigrationInterface {
  name = "AddGroupsFeature1710000000011";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create group visibility enum type
    await queryRunner.query(`
      CREATE TYPE "public"."group_visibility_enum" AS ENUM('PUBLIC', 'PRIVATE')
    `);

    // Create group member role enum type
    await queryRunner.query(`
      CREATE TYPE "public"."group_member_role_enum" AS ENUM('MEMBER', 'ADMIN')
    `);

    // Create group membership status enum type
    await queryRunner.query(`
      CREATE TYPE "public"."group_membership_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'BANNED')
    `);

    // Create groups table
    await queryRunner.query(`
      CREATE TABLE "groups" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(100) NOT NULL,
        "description" text,
        "emoji" character varying,
        "banner_image_url" character varying,
        "avatar_image_url" character varying,
        "visibility" "public"."group_visibility_enum" NOT NULL DEFAULT 'PUBLIC',
        "owner_id" uuid NOT NULL,
        "location" geometry(Point, 4326),
        "address" text,
        "member_count" integer NOT NULL DEFAULT 1,
        "allow_member_event_creation" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_groups" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_groups_name" UNIQUE ("name")
      )
    `);

    // Create group_memberships table
    await queryRunner.query(`
      CREATE TABLE "group_memberships" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "group_id" uuid NOT NULL,
        "role" "public"."group_member_role_enum" NOT NULL DEFAULT 'MEMBER',
        "status" "public"."group_membership_status_enum" NOT NULL DEFAULT 'APPROVED',
        "joined_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_group_memberships" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_group_memberships_user_group" UNIQUE ("user_id", "group_id")
      )
    `);

    // Create group_categories junction table
    await queryRunner.query(`
      CREATE TABLE "group_categories" (
        "group_id" uuid NOT NULL,
        "category_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_group_categories" PRIMARY KEY ("group_id", "category_id")
      )
    `);

    // Add group_id column to events table
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN "group_id" uuid
    `);

    // Add indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_groups_owner_id" ON "groups" ("owner_id");
      CREATE INDEX "IDX_groups_location" ON "groups" USING GIST ("location");
      CREATE INDEX "IDX_group_memberships_user_id" ON "group_memberships" ("user_id");
      CREATE INDEX "IDX_group_memberships_group_id" ON "group_memberships" ("group_id");
      CREATE INDEX "IDX_group_memberships_status" ON "group_memberships" ("status");
      CREATE INDEX "IDX_events_group_id" ON "events" ("group_id");
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "groups"
      ADD CONSTRAINT "FK_groups_owner"
      FOREIGN KEY ("owner_id")
      REFERENCES "users"("id")
      ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "group_memberships"
      ADD CONSTRAINT "FK_group_memberships_user"
      FOREIGN KEY ("user_id")
      REFERENCES "users"("id")
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "group_memberships"
      ADD CONSTRAINT "FK_group_memberships_group"
      FOREIGN KEY ("group_id")
      REFERENCES "groups"("id")
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "group_categories"
      ADD CONSTRAINT "FK_group_categories_group"
      FOREIGN KEY ("group_id")
      REFERENCES "groups"("id")
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "group_categories"
      ADD CONSTRAINT "FK_group_categories_category"
      FOREIGN KEY ("category_id")
      REFERENCES "categories"("id")
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "events"
      ADD CONSTRAINT "FK_events_group"
      FOREIGN KEY ("group_id")
      REFERENCES "groups"("id")
      ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "events" DROP CONSTRAINT "FK_events_group"
    `);

    await queryRunner.query(`
      ALTER TABLE "group_categories" DROP CONSTRAINT "FK_group_categories_category"
    `);

    await queryRunner.query(`
      ALTER TABLE "group_categories" DROP CONSTRAINT "FK_group_categories_group"
    `);

    await queryRunner.query(`
      ALTER TABLE "group_memberships" DROP CONSTRAINT "FK_group_memberships_group"
    `);

    await queryRunner.query(`
      ALTER TABLE "group_memberships" DROP CONSTRAINT "FK_group_memberships_user"
    `);

    await queryRunner.query(`
      ALTER TABLE "groups" DROP CONSTRAINT "FK_groups_owner"
    `);

    // Remove indexes
    await queryRunner.query(`
      DROP INDEX "IDX_events_group_id"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_group_memberships_status"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_group_memberships_group_id"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_group_memberships_user_id"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_groups_location"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_groups_owner_id"
    `);

    // Remove group_id column from events
    await queryRunner.query(`
      ALTER TABLE "events" DROP COLUMN "group_id"
    `);

    // Drop tables
    await queryRunner.query(`
      DROP TABLE "group_categories"
    `);

    await queryRunner.query(`
      DROP TABLE "group_memberships"
    `);

    await queryRunner.query(`
      DROP TABLE "groups"
    `);

    // Drop enum types
    await queryRunner.query(`
      DROP TYPE "public"."group_membership_status_enum"
    `);

    await queryRunner.query(`
      DROP TYPE "public"."group_member_role_enum"
    `);

    await queryRunner.query(`
      DROP TYPE "public"."group_visibility_enum"
    `);
  }
}
