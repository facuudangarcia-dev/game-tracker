import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Usernames keep their case and are unique ignoring it (decision #76): the
 * format allows uppercase letters and the unique index is on lower("username").
 */
export class CaseSensitiveUsernames1791731106913 implements MigrationInterface {
  name = 'CaseSensitiveUsernames1791731106913';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_users_username"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "CHK_users_username_format"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "CHK_users_username_format" CHECK ("username" ~ '^[A-Za-z0-9_]{3,30}$')`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_username_lower" ON "users" (lower("username"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_users_username_lower"`);
    // Back to lowercase usernames (unique ignoring case, so no duplicates appear).
    await queryRunner.query(`UPDATE "users" SET "username" = lower("username")`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "CHK_users_username_format"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "CHK_users_username_format" CHECK ("username" ~ '^[a-z0-9_]{3,30}$')`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_username" ON "users" USING btree ("username") `,
    );
  }
}
