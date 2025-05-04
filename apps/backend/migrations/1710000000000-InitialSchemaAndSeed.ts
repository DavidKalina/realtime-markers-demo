import type { MigrationInterface, QueryRunner } from "typeorm";
import * as bcrypt from "bcrypt";
import { UserRole } from "../entities/User";
import { FriendshipStatus } from "../entities/Friendship";
import { EventStatus } from "../entities/Event";

export class InitialSchemaAndSeed1710000000000 implements MigrationInterface {
  name = "InitialSchemaAndSeed1710000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "username" character varying,
        "friend_code" character varying,
        "phone" character varying,
        "password_hash" character varying NOT NULL,
        "display_name" character varying,
        "avatar_url" character varying,
        "bio" text,
        "role" character varying NOT NULL DEFAULT 'USER',
        "plan_type" character varying NOT NULL DEFAULT 'FREE',
        "is_verified" boolean NOT NULL DEFAULT false,
        "discovery_count" integer NOT NULL DEFAULT 0,
        "scan_count" integer NOT NULL DEFAULT 0,
        "save_count" integer NOT NULL DEFAULT 0,
        "weekly_scan_count" integer NOT NULL DEFAULT 0,
        "last_scan_reset" TIMESTAMP,
        "total_xp" integer NOT NULL DEFAULT 0,
        "current_title" character varying,
        "contacts" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "refresh_token" character varying,
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "UQ_users_username" UNIQUE ("username"),
        CONSTRAINT "UQ_users_friend_code" UNIQUE ("friend_code"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    // Create categories table
    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "description" text,
        "emoji" character varying,
        "icon" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_categories" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_categories_name" UNIQUE ("name")
      )
    `);

    // Create events table
    await queryRunner.query(`
      CREATE TABLE "events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "emoji" character varying DEFAULT '📍',
        "emoji_description" character varying,
        "title" character varying NOT NULL,
        "description" text,
        "event_date" TIMESTAMP NOT NULL,
        "end_date" TIMESTAMP,
        "timezone" character varying DEFAULT 'UTC',
        "address" text,
        "location_notes" text,
        "location" geometry(Point, 4326) NOT NULL,
        "scan_count" integer NOT NULL DEFAULT 1,
        "save_count" integer NOT NULL DEFAULT 0,
        "confidence_score" float,
        "embedding" vector(1536),
        "status" character varying NOT NULL DEFAULT 'PENDING',
        "qr_url" text,
        "qr_code_data" text,
        "qr_image_path" text,
        "has_qr_code" boolean NOT NULL DEFAULT false,
        "is_private" boolean NOT NULL DEFAULT false,
        "qr_generated_at" TIMESTAMP,
        "qr_detected_in_image" boolean NOT NULL DEFAULT false,
        "detected_qr_data" text,
        "original_image_url" text,
        "creator_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_events_creator" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // Create event_categories junction table
    await queryRunner.query(`
      CREATE TABLE "event_categories" (
        "event_id" uuid NOT NULL,
        "category_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_event_categories" PRIMARY KEY ("event_id", "category_id"),
        CONSTRAINT "FK_event_categories_event" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_event_categories_category" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE
      )
    `);

    // Create user_event_discoveries table
    await queryRunner.query(`
      CREATE TABLE "user_event_discoveries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "event_id" uuid NOT NULL,
        "discovered_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_event_discoveries" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_event_discoveries_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_event_discoveries_event" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE
      )
    `);

    // Create user_event_saves table
    await queryRunner.query(`
      CREATE TABLE "user_event_saves" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "event_id" uuid NOT NULL,
        "saved_at" TIMESTAMP NOT NULL DEFAULT now(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_event_saves" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_event_saves_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_event_saves_event" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE
      )
    `);

    // Create event_shares table
    await queryRunner.query(`
      CREATE TABLE "event_shares" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_id" uuid NOT NULL,
        "shared_with_id" uuid NOT NULL,
        "shared_by_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_event_shares" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_event_shares_event_shared_with" UNIQUE ("event_id", "shared_with_id"),
        CONSTRAINT "FK_event_shares_event" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_event_shares_shared_with" FOREIGN KEY ("shared_with_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_event_shares_shared_by" FOREIGN KEY ("shared_by_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create filters table
    await queryRunner.query(`
      CREATE TABLE "filters" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "semantic_query" text,
        "embedding" vector(1536),
        "emoji" character varying,
        "criteria" jsonb NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_filters" PRIMARY KEY ("id"),
        CONSTRAINT "FK_filters_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create basic index for filters
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_filters_user_id" ON "filters" ("user_id");
      CREATE INDEX IF NOT EXISTS "IDX_filters_is_active" ON "filters" ("is_active");
    `);

    // Create friendships table
    await queryRunner.query(`
      CREATE TABLE "friendships" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "requester_id" uuid NOT NULL,
        "addressee_id" uuid NOT NULL,
        "status" character varying NOT NULL DEFAULT 'PENDING',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_friendships_requester_addressee" UNIQUE ("requester_id", "addressee_id"),
        CONSTRAINT "PK_friendships" PRIMARY KEY ("id"),
        CONSTRAINT "FK_friendships_requester" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_friendships_addressee" FOREIGN KEY ("addressee_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_events_event_date" ON "events" ("event_date");
      CREATE INDEX IF NOT EXISTS "IDX_events_end_date" ON "events" ("end_date");
      CREATE INDEX IF NOT EXISTS "IDX_events_address" ON "events" ("address");
      CREATE INDEX IF NOT EXISTS "IDX_events_creator_id" ON "events" ("creator_id");
      CREATE INDEX IF NOT EXISTS "IDX_events_status" ON "events" ("status");
      CREATE INDEX IF NOT EXISTS "IDX_events_location" ON "events" USING GIST ("location");
      CREATE INDEX IF NOT EXISTS "IDX_events_title_trgm" ON "events" USING gin ("title" gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS "IDX_events_description_trgm" ON "events" USING gin ("description" gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS "IDX_filters_user_id" ON "filters" ("user_id");
      CREATE INDEX IF NOT EXISTS "IDX_filters_is_active" ON "filters" ("is_active");
      CREATE INDEX IF NOT EXISTS "IDX_user_event_discoveries_user_id" ON "user_event_discoveries" ("user_id");
      CREATE INDEX IF NOT EXISTS "IDX_user_event_discoveries_event_id" ON "user_event_discoveries" ("event_id");
      CREATE INDEX IF NOT EXISTS "IDX_user_event_saves_user_id" ON "user_event_saves" ("user_id");
      CREATE INDEX IF NOT EXISTS "IDX_user_event_saves_event_id" ON "user_event_saves" ("event_id");
      CREATE INDEX IF NOT EXISTS "IDX_event_shares_event_id" ON "event_shares" ("event_id");
      CREATE INDEX IF NOT EXISTS "IDX_event_shares_shared_with_id" ON "event_shares" ("shared_with_id");
      CREATE INDEX IF NOT EXISTS "IDX_event_shares_shared_by_id" ON "event_shares" ("shared_by_id");
      CREATE INDEX IF NOT EXISTS "IDX_friendships_requester_id" ON "friendships" ("requester_id");
      CREATE INDEX IF NOT EXISTS "IDX_friendships_addressee_id" ON "friendships" ("addressee_id");
    `);

    // Seed test users
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash("password123!", saltRounds);

    const users = [
      {
        email: "david@example.com",
        passwordHash: passwordHash,
        displayName: "David K",
        username: "davidk",
        friendCode: "DAVID1",
        bio: "System administrator",
        role: UserRole.ADMIN,
        isVerified: true,
      },
      {
        email: "james@example.com",
        passwordHash: passwordHash,
        displayName: "James H.",
        username: "jamesh",
        friendCode: "JAMES1",
        bio: "Content moderator",
        role: UserRole.ADMIN,
        isVerified: true,
      },
    ];

    for (const user of users) {
      await queryRunner.query(
        `
        INSERT INTO "users" (
          "email", "password_hash", "display_name", "username",
          "friend_code", "bio", "role", "is_verified"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        )
      `,
        [
          user.email,
          user.passwordHash,
          user.displayName,
          user.username,
          user.friendCode,
          user.bio,
          user.role,
          user.isVerified,
        ]
      );
    }

    // Create friendship between David and James
    await queryRunner.query(
      `
      INSERT INTO "friendships" (
        "requester_id", "addressee_id", "status"
      )
      SELECT 
        (SELECT id FROM users WHERE username = 'davidk'),
        (SELECT id FROM users WHERE username = 'jamesh'),
        $1
    `,
      [FriendshipStatus.ACCEPTED]
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order of creation
    await queryRunner.query(`DROP TABLE IF EXISTS "user_levels"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "levels"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "filters"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "event_shares"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_event_saves"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_event_discoveries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "event_categories"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "categories"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "friendships"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
