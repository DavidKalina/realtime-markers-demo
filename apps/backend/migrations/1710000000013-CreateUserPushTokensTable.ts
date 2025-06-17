import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUserPushTokensTable1710000000013
  implements MigrationInterface
{
  name = "CreateUserPushTokensTable1710000000013";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create user_push_tokens table
    await queryRunner.query(`
      CREATE TABLE "user_push_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "token" character varying NOT NULL,
        "device_type" character varying NOT NULL,
        "device_id" character varying,
        "app_version" character varying,
        "os_version" character varying,
        "is_active" boolean NOT NULL DEFAULT true,
        "last_used_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_push_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_push_tokens_token" UNIQUE ("token"),
        CONSTRAINT "FK_user_push_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_push_tokens_user_id" ON "user_push_tokens" ("user_id");
      CREATE INDEX IF NOT EXISTS "IDX_user_push_tokens_is_active" ON "user_push_tokens" ("is_active");
      CREATE INDEX IF NOT EXISTS "IDX_user_push_tokens_device_type" ON "user_push_tokens" ("device_type");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_user_push_tokens_device_type";
      DROP INDEX IF EXISTS "IDX_user_push_tokens_is_active";
      DROP INDEX IF EXISTS "IDX_user_push_tokens_user_id";
    `);

    // Drop table
    await queryRunner.query(`
      DROP TABLE "user_push_tokens"
    `);
  }
}
