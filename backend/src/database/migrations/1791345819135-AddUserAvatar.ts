import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserAvatar1791345819135 implements MigrationInterface {
  name = 'AddUserAvatar1791345819135';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "avatar_preset" character varying(40)`);
    await queryRunner.query(`ALTER TABLE "users" ADD "avatar_asset_key" character varying(200)`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "CHK_users_single_avatar" CHECK ("avatar_preset" IS NULL OR "avatar_asset_key" IS NULL)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "CHK_users_single_avatar"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatar_asset_key"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatar_preset"`);
  }
}
