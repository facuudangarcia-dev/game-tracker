import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlaythroughDifficulties1791328891209 implements MigrationInterface {
  name = 'AddPlaythroughDifficulties1791328891209';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "difficulties" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_game_id" uuid NOT NULL, "kind" character varying(20) NOT NULL, "name" character varying(100) NOT NULL, "position" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_difficulties_position" CHECK ("position" >= 0), CONSTRAINT "CHK_difficulties_name_not_blank" CHECK (btrim("name") <> ''), CONSTRAINT "CHK_difficulties_kind" CHECK ("kind" IN ('PLAYTHROUGH', 'PLATINUM')), CONSTRAINT "PK_4c3dd46c9ed9b426d0307e45b3e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_difficulties_user_game_kind_position" ON "difficulties"  ("user_game_id", "kind", "position") `,
    );
    await queryRunner.query(`ALTER TABLE "playthroughs" ADD "difficulty_id" uuid`);
    await queryRunner.query(
      `CREATE INDEX "IDX_playthroughs_difficulty_id" ON "playthroughs"  ("difficulty_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "playthroughs" ADD CONSTRAINT "FK_d6993c776d609c34d203e5ea622" FOREIGN KEY ("difficulty_id") REFERENCES "difficulties"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "difficulties" ADD CONSTRAINT "FK_c3f603c03a1c79b9c7741c28f4b" FOREIGN KEY ("user_game_id") REFERENCES "user_games"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    // Backfill: every existing UserGame gets the default playthrough difficulties
    // (new ones get them on creation). Names inlined: migrations are snapshots.
    await queryRunner.query(
      `INSERT INTO "difficulties" ("user_game_id", "kind", "name", "position")
       SELECT ug.id, 'PLAYTHROUGH', d.name, d.position
       FROM "user_games" ug
       CROSS JOIN (VALUES ('Muy fácil', 0), ('Fácil', 1), ('Normal', 2), ('Difícil', 3), ('Muy difícil', 4))
         AS d(name, position)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "difficulties" DROP CONSTRAINT "FK_c3f603c03a1c79b9c7741c28f4b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "playthroughs" DROP CONSTRAINT "FK_d6993c776d609c34d203e5ea622"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_playthroughs_difficulty_id"`);
    await queryRunner.query(`ALTER TABLE "playthroughs" DROP COLUMN "difficulty_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_difficulties_user_game_kind_position"`);
    await queryRunner.query(`DROP TABLE "difficulties"`);
  }
}
