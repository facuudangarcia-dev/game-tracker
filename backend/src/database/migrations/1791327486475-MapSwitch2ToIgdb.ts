import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Maps Nintendo Switch 2 to its IGDB platform id, verified against the IGDB API
 * with `npm run catalog:verify-igdb` (2026-10-06: 508 = "Nintendo Switch 2").
 * The other seeded platform, genre and game type ids were verified as correct.
 */
export class MapSwitch2ToIgdb1791327486475 implements MigrationInterface {
  name = 'MapSwitch2ToIgdb1791327486475';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const inserted = (await queryRunner.query(
      `INSERT INTO "platform_external_ids" ("provider", "external_id", "platform_id")
       SELECT 'igdb', '508', "id" FROM "platforms" WHERE "slug" = 'switch-2'
       RETURNING "external_id"`,
    )) as { external_id: string }[];
    if (inserted.length !== 1) {
      throw new Error('Platform "switch-2" not found: cannot map it to IGDB 508');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "platform_external_ids" WHERE "provider" = 'igdb' AND "external_id" = '508'`,
    );
  }
}
