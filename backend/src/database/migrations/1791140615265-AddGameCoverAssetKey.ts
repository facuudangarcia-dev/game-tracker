import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGameCoverAssetKey1791140615265 implements MigrationInterface {
  name = 'AddGameCoverAssetKey1791140615265';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "games" ADD "cover_asset_key" character varying(200)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "games" DROP COLUMN "cover_asset_key"`);
  }
}
