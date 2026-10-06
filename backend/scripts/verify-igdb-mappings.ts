/**
 * Verifies the IGDB ids seeded in the database (platforms, genres) and the
 * allowed game types against the live IGDB API.
 *
 *   npm run catalog:verify-igdb
 *
 * Read-only: it prints a report and exits with code 1 if anything doesn't
 * match. Fixes are applied through a reviewed migration (docs/decisions.md #26).
 * Never prints credentials or tokens.
 */
import 'reflect-metadata';
import { createDataSource } from '../src/database/data-source';
import { IgdbClient } from '../src/catalog/igdb/igdb-client';
import { IGDB_ALLOWED_GAME_TYPES, IgdbProvider } from '../src/catalog/igdb/igdb.provider';

interface MappingRow {
  slug: string;
  name: string;
  external_id: string | null;
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

async function main(): Promise<number> {
  const clientId = process.env.IGDB_CLIENT_ID?.trim();
  const clientSecret = process.env.IGDB_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    console.error('IGDB_CLIENT_ID and IGDB_CLIENT_SECRET must be set in .env');
    return 2;
  }

  const igdb = new IgdbProvider(new IgdbClient({ clientId, clientSecret }));
  const dataSource = createDataSource();
  await dataSource.initialize();
  let problems = 0;

  try {
    const [igdbPlatforms, igdbGenres, igdbGameTypes] = await Promise.all([
      igdb.listPlatforms(),
      igdb.listGenres(),
      igdb.listGameTypes(),
    ]);
    const platformsById = new Map(igdbPlatforms.map((p) => [p.externalId, p]));
    const genresById = new Map(igdbGenres.map((g) => [g.externalId, g]));

    console.log('\n== Platforms ==');
    const platformRows = await dataSource.query<MappingRow[]>(
      `SELECT p.slug, p.name, e.external_id FROM platforms p
       LEFT JOIN platform_external_ids e ON e.platform_id = p.id AND e.provider = 'igdb'
       ORDER BY p.sort_order, e.external_id`,
    );
    for (const row of platformRows) {
      if (row.external_id === null) {
        const words = normalize(row.name);
        const candidates = igdbPlatforms.filter((p) => normalize(p.name).includes(words));
        console.log(
          `?  ${row.slug.padEnd(14)} no mapping. Candidates: ${
            candidates.map((c) => `${c.externalId}="${c.name}"`).join(', ') || 'none'
          }`,
        );
        problems++;
        continue;
      }
      const igdbPlatform = platformsById.get(row.external_id);
      const ok = igdbPlatform !== undefined;
      if (!ok) problems++;
      console.log(
        `${ok ? 'OK' : 'X '} ${row.slug.padEnd(14)} ${row.external_id.padStart(4)} → ${
          igdbPlatform ? `"${igdbPlatform.name}"` : 'NOT FOUND in IGDB'
        }  (ours: "${row.name}")`,
      );
    }

    console.log('\n== Genres ==');
    const genreRows = await dataSource.query<MappingRow[]>(
      `SELECT g.slug, g.name, e.external_id FROM genres g
       LEFT JOIN genre_external_ids e ON e.genre_id = g.id AND e.provider = 'igdb'
       ORDER BY e.external_id::int NULLS LAST`,
    );
    const mappedGenreIds = new Set<string>();
    for (const row of genreRows) {
      const igdbGenre = row.external_id ? genresById.get(row.external_id) : undefined;
      if (row.external_id) mappedGenreIds.add(row.external_id);
      // Our slugs are our own identifiers; IGDB's may add a suffix ("role-playing" vs
      // "role-playing-rpg"), so the IGDB slug must start with ours.
      const ok =
        igdbGenre !== undefined && normalize(igdbGenre.slug ?? '').startsWith(normalize(row.slug));
      if (!ok) problems++;
      console.log(
        `${ok ? 'OK' : 'X '} ${row.slug.padEnd(22)} ${String(row.external_id).padStart(4)} → ${
          igdbGenre ? `"${igdbGenre.name}" (slug ${igdbGenre.slug})` : 'NOT FOUND in IGDB'
        }`,
      );
    }
    for (const genre of igdbGenres.filter((g) => !mappedGenreIds.has(g.externalId))) {
      console.log(`+  IGDB genre without mapping: ${genre.externalId}="${genre.name}"`);
      problems++;
    }

    console.log('\n== Allowed game types ==');
    const typesById = new Map(igdbGameTypes.map((t) => [t.externalId, t.type]));
    for (const [name, id] of Object.entries(IGDB_ALLOWED_GAME_TYPES)) {
      const igdbType = typesById.get(String(id));
      const ok = igdbType !== undefined && normalize(igdbType) === normalize(name);
      if (!ok) problems++;
      console.log(
        `${ok ? 'OK' : 'X '} ${name.padEnd(22)} ${String(id).padStart(3)} → ${igdbType ?? 'NOT FOUND'}`,
      );
    }
    console.log(
      '   All IGDB game types:',
      igdbGameTypes.map((t) => `${t.externalId}=${t.type}`).join(', '),
    );
  } finally {
    await dataSource.destroy();
  }

  console.log(problems === 0 ? '\nAll mappings verified.' : `\n${problems} problem(s) found.`);
  return problems === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    // Name, code and message only: never request options (they carry headers).
    // Errors from IgdbClient never contain credentials.
    const { name, message, code } = error as Error & { code?: string };
    console.error(`Verification failed: ${name}${code ? ` (${code})` : ''}: ${message || '-'}`);
    process.exit(2);
  },
);
