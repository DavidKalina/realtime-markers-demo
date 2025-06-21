import { TableForeignKey } from "typeorm";
import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddAllUserForeignKeys1710000000014 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add foreign key constraints for tables that don't already have them
    // Note: user_event_discoveries, user_event_rsvps, user_event_saves,
    // user_event_views, and friendships already have their foreign keys defined
    // in their respective table creation migrations

    // Events table - creator_id foreign key
    await queryRunner.createForeignKey(
      "events",
      new TableForeignKey({
        columnNames: ["creator_id"],
        referencedTableName: "users",
        referencedColumnNames: ["id"],
        onDelete: "SET NULL",
      }),
    );

    // Event shares table - shared_with_id and shared_by_id foreign keys
    await queryRunner.createForeignKey(
      "event_shares",
      new TableForeignKey({
        columnNames: ["shared_with_id"],
        referencedTableName: "users",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      }),
    );

    await queryRunner.createForeignKey(
      "event_shares",
      new TableForeignKey({
        columnNames: ["shared_by_id"],
        referencedTableName: "users",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      }),
    );

    // Filters table - user_id foreign key
    await queryRunner.createForeignKey(
      "filters",
      new TableForeignKey({
        columnNames: ["user_id"],
        referencedTableName: "users",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      }),
    );

    // Notifications table - userId foreign key
    await queryRunner.createForeignKey(
      "notifications",
      new TableForeignKey({
        columnNames: ["userId"],
        referencedTableName: "users",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints in reverse order
    await queryRunner.dropForeignKey(
      "notifications",
      "FK_692a909ee0fa9383e7859f9b406",
    );
    await queryRunner.dropForeignKey(
      "filters",
      "FK_03cae8398ba982cf0b26e714c6f",
    );
    await queryRunner.dropForeignKey(
      "event_shares",
      "FK_41e912fbc9c67e23363fc3fedc0",
    );
    await queryRunner.dropForeignKey(
      "event_shares",
      "FK_2e732410994cd4d4c95d9aeef29",
    );
    await queryRunner.dropForeignKey(
      "events",
      "FK_39f98b48445861611ea17108071",
    );
  }
}
