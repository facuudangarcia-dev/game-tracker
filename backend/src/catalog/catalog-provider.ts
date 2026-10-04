/**
 * External game catalog providers. Catalog data (games, platform and genre
 * mappings) is keyed by provider so more sources can be added later.
 */
export enum CatalogProvider {
  Igdb = 'igdb',
}

export const EXTERNAL_ID_MAX_LENGTH = 64;
export const PROVIDER_MAX_LENGTH = 20;
