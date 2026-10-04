import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reference data: platforms (docs/decisions.md #22, #23) and genres (#25) with
 * their IGDB mappings. Data is inlined on purpose: a migration is an immutable
 * snapshot and must not depend on application code that may change later.
 *
 * IGDB ids: Nintendo Switch 2 has no mapping yet because its IGDB id could not
 * be verified without API credentials; mappings are verified against the IGDB
 * API (and completed by a new migration) when the IGDB integration is built.
 */

// [slug, name, shortName, igdbIds]
const PLATFORMS: [string, string, string, number[]][] = [
  ['ps5', 'PlayStation 5', 'PS5', [167]],
  ['ps4', 'PlayStation 4', 'PS4', [48]],
  ['ps3', 'PlayStation 3', 'PS3', [9]],
  ['ps2', 'PlayStation 2', 'PS2', [8]],
  ['ps1', 'PlayStation', 'PS1', [7]],
  ['ps-vita', 'PlayStation Vita', 'PS Vita', [46]],
  ['psp', 'PlayStation Portable', 'PSP', [38]],
  ['xbox-series', 'Xbox Series X|S', 'Xbox Series X|S', [169]],
  ['xbox-one', 'Xbox One', 'Xbox One', [49]],
  ['xbox-360', 'Xbox 360', 'Xbox 360', [12]],
  ['xbox', 'Xbox', 'Xbox', [11]],
  ['switch-2', 'Nintendo Switch 2', 'Switch 2', []],
  ['switch', 'Nintendo Switch', 'Switch', [130]],
  ['wii-u', 'Wii U', 'Wii U', [41]],
  ['wii', 'Wii', 'Wii', [5]],
  ['gamecube', 'Nintendo GameCube', 'GameCube', [21]],
  ['n64', 'Nintendo 64', 'N64', [4]],
  ['snes', 'Super Nintendo', 'SNES', [19]],
  ['nes', 'Nintendo Entertainment System', 'NES', [18]],
  ['3ds', 'Nintendo 3DS', '3DS', [37]],
  ['ds', 'Nintendo DS', 'DS', [20]],
  ['gba', 'Game Boy Advance', 'GBA', [24]],
  ['gbc', 'Game Boy Color', 'GBC', [22]],
  ['gb', 'Game Boy', 'Game Boy', [33]],
  // Windows (6), Mac (14) and Linux (3) are a single "PC" platform (decision #23).
  ['pc', 'PC', 'PC', [6, 14, 3]],
  ['ios', 'iOS', 'iOS', [39]],
  ['android', 'Android', 'Android', [34]],
  ['dreamcast', 'Dreamcast', 'Dreamcast', [23]],
  ['saturn', 'Sega Saturn', 'Saturn', [32]],
  ['mega-drive', 'Sega Mega Drive / Genesis', 'Mega Drive', [29]],
  ['master-system', 'Sega Master System', 'Master System', [64]],
];

// [slug, Spanish name, igdbId]
const GENRES: [string, string, number][] = [
  ['point-and-click', 'Aventura gráfica', 2],
  ['fighting', 'Lucha', 4],
  ['shooter', 'Disparos', 5],
  ['music', 'Música', 7],
  ['platform', 'Plataformas', 8],
  ['puzzle', 'Puzles', 9],
  ['racing', 'Carreras', 10],
  ['real-time-strategy', 'Estrategia en tiempo real', 11],
  ['role-playing', 'Rol (RPG)', 12],
  ['simulator', 'Simulación', 13],
  ['sport', 'Deportes', 14],
  ['strategy', 'Estrategia', 15],
  ['turn-based-strategy', 'Estrategia por turnos', 16],
  ['tactical', 'Táctico', 24],
  ['hack-and-slash', "Hack and slash / Beat 'em up", 25],
  ['quiz-trivia', 'Preguntas y respuestas', 26],
  ['pinball', 'Pinball', 30],
  ['adventure', 'Aventura', 31],
  ['indie', 'Indie', 32],
  ['arcade', 'Arcade', 33],
  ['visual-novel', 'Novela visual', 34],
  ['card-and-board', 'Cartas y juegos de mesa', 35],
  ['moba', 'MOBA', 36],
];

const PROVIDER = 'igdb';

export class SeedPlatformsAndGenres1791133421261 implements MigrationInterface {
  name = 'SeedPlatformsAndGenres1791133421261';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [index, [slug, name, shortName, igdbIds]] of PLATFORMS.entries()) {
      await queryRunner.query(
        `INSERT INTO "platforms" ("slug", "name", "short_name", "sort_order") VALUES ($1, $2, $3, $4)`,
        [slug, name, shortName, (index + 1) * 10],
      );
      for (const igdbId of igdbIds) {
        await queryRunner.query(
          `INSERT INTO "platform_external_ids" ("provider", "external_id", "platform_id")
           SELECT $1, $2, "id" FROM "platforms" WHERE "slug" = $3`,
          [PROVIDER, String(igdbId), slug],
        );
      }
    }

    for (const [slug, name, igdbId] of GENRES) {
      await queryRunner.query(`INSERT INTO "genres" ("slug", "name") VALUES ($1, $2)`, [
        slug,
        name,
      ]);
      await queryRunner.query(
        `INSERT INTO "genre_external_ids" ("provider", "external_id", "genre_id")
         SELECT $1, $2, "id" FROM "genres" WHERE "slug" = $3`,
        [PROVIDER, String(igdbId), slug],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // External id rows go away through ON DELETE CASCADE.
    await queryRunner.query(`DELETE FROM "genres" WHERE "slug" = ANY($1)`, [
      GENRES.map(([slug]) => slug),
    ]);
    await queryRunner.query(`DELETE FROM "platforms" WHERE "slug" = ANY($1)`, [
      PLATFORMS.map(([slug]) => slug),
    ]);
  }
}
