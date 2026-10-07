import { API_PREFIX } from '../app.setup';
import type { CatalogProvider } from './catalog-provider';

/** URL of a stored asset, served by AssetsController. */
export function assetUrl(key: string): string {
  return `/${API_PREFIX}/assets/${key}`;
}

/** URL of a provider thumbnail proxied by the backend (decision #30). */
export function catalogThumbnailUrl(provider: CatalogProvider, ref: string): string {
  return `/${API_PREFIX}/catalog/${provider}/images/${ref}`;
}

/** Larger proxied cover for the catalog detail page (not stored either). */
export function catalogCoverUrl(provider: CatalogProvider, ref: string): string {
  return `${catalogThumbnailUrl(provider, ref)}?size=cover`;
}

/** Wide high-resolution artwork for the Home hero (not stored either). */
export function catalogArtworkUrl(provider: CatalogProvider, ref: string): string {
  return `${catalogThumbnailUrl(provider, ref)}?size=artwork`;
}
