/* eslint-disable @typescript-eslint/no-unused-vars */
import type { MigrationInterface, QueryRunner } from "typeorm";

export class SeedUsers1710000000012 implements MigrationInterface {
  name = "SeedUsers1710000000012";

  public async up(_queryRunner: QueryRunner): Promise<void> {
    console.log("SeedUsers migration - This migration requires bcrypt");
    console.log("Please implement the user seeding logic in your application");
    console.log(
      "This migration is a placeholder and does not perform any operations",
    );

    // This migration requires bcrypt for password hashing
    // It should be implemented by the consuming application
    // The original migration logic can be found in the backend app
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log("SeedUsers down migration - Removing seeded users");
    await queryRunner.query(`
      DELETE FROM users 
      WHERE email IN ('admin@example.com', 'moderator@example.com', 'user@example.com');
    `);
    console.log("Seeded users removed");
  }
}
