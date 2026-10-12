import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserCountry1791685150376 implements MigrationInterface {
  name = 'AddUserCountry1791685150376';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "country" character(2)`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "CHK_users_country_format" CHECK ("country" ~ '^[A-Z]{2}$')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "CHK_users_country_format"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "country"`);
  }
}
