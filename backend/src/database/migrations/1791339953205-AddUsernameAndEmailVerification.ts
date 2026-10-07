import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUsernameAndEmailVerification1791339953205 implements MigrationInterface {
  name = 'AddUsernameAndEmailVerification1791339953205';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Username and the acceptance of the legal documents are mandatory and can't be
    // invented for existing accounts: they were removed before this migration
    // (docs/decisions.md #49). Refuse to run instead of fabricating that data.
    const [{ count }] = (await queryRunner.query(`SELECT count(*)::int AS count FROM "users"`)) as {
      count: number;
    }[];
    if (count > 0) {
      throw new Error(
        'AddUsernameAndEmailVerification requires an empty users table: existing accounts have no username nor accepted terms.',
      );
    }
    await queryRunner.query(`ALTER TABLE "users" ADD "username" character varying(30) NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "email_verified" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "email_verification_code_hash" character(64)`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "email_verification_code_expires_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "email_verification_attempts" smallint NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "email_verification_sent_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "terms_accepted_at" TIMESTAMP WITH TIME ZONE NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "terms_version" character varying(20) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "privacy_accepted_at" TIMESTAMP WITH TIME ZONE NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "privacy_version" character varying(20) NOT NULL`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_users_username" ON "users"  ("username") `);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "CHK_users_username_format" CHECK ("username" ~ '^[a-z0-9_]{3,30}$')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "CHK_users_username_format"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_users_username"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "privacy_version"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "privacy_accepted_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "terms_version"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "terms_accepted_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_verification_sent_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_verification_attempts"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_verification_code_expires_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_verification_code_hash"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_verified"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "username"`);
  }
}
