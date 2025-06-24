import { type MigrationInterface, type QueryRunner } from "typeorm";

export class UserPushTokenTable1710000000022 implements MigrationInterface {
  name = "UserPushTokenTable1710000000022";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create user_push_tokens table
    await queryRunner.query(`
      CREATE TABLE "user_push_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "token" text NOT NULL,
        "device_info" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "last_used_at" timestamp,
        "is_active" boolean NOT NULL DEFAULT true,
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_push_tokens" PRIMARY KEY ("id")
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_user_push_tokens_user_id_token" 
      ON "user_push_tokens" ("user_id", "token")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_push_tokens_token" 
      ON "user_push_tokens" ("token")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_push_tokens_is_active" 
      ON "user_push_tokens" ("is_active")
    `);

    // Create foreign key
    await queryRunner.query(`
      ALTER TABLE "user_push_tokens" 
      ADD CONSTRAINT "FK_user_push_tokens_user_id" 
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    console.log(
      "✅ Created user_push_tokens table with indexes and foreign key",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key
    await queryRunner.query(`
      ALTER TABLE "user_push_tokens" 
      DROP CONSTRAINT "FK_user_push_tokens_user_id"
    `);

    // Drop indexes
    await queryRunner.query(`
      DROP INDEX "IDX_user_push_tokens_user_id_token"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_user_push_tokens_token"
    `);

    await queryRunner.query(`
      DROP INDEX "IDX_user_push_tokens_is_active"
    `);

    // Drop table
    await queryRunner.query(`
      DROP TABLE "user_push_tokens"
    `);

    console.log("✅ Dropped user_push_tokens table");
  }
}
