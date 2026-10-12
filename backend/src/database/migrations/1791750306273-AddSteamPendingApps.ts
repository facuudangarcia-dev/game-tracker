import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSteamPendingApps1791750306273 implements MigrationInterface {
  name = 'AddSteamPendingApps1791750306273';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "steam_pending_apps" ("user_id" uuid NOT NULL, "app_id" integer NOT NULL, "name" character varying(200) NOT NULL, "minutes" integer NOT NULL, "game_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_47d3cf7d273ed653115dab85516" PRIMARY KEY ("user_id", "app_id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "steam_pending_apps" ADD CONSTRAINT "FK_3507d6cd3d4e47c5298b1464c37" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "steam_pending_apps" ADD CONSTRAINT "FK_42e8dbbfdda318fe56b705a94ca" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "steam_pending_apps" DROP CONSTRAINT "FK_42e8dbbfdda318fe56b705a94ca"`,
    );
    await queryRunner.query(
      `ALTER TABLE "steam_pending_apps" DROP CONSTRAINT "FK_3507d6cd3d4e47c5298b1464c37"`,
    );
    await queryRunner.query(`DROP TABLE "steam_pending_apps"`);
  }
}
