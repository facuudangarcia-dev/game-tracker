import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi, testUser } from '../../test/mockApi';
import { renderRoute } from '../../test/renderRoute';
import type { CatalogHighlight, CatalogHighlights, Platform } from '../library/types';
import { calendarParts, pickFeatured } from './homeFormat';

const ps5: Platform = { id: 'p-ps5', slug: 'ps5', name: 'PlayStation 5', shortName: 'PS5' };
const pc: Platform = { id: 'p-pc', slug: 'pc', name: 'PC', shortName: 'PC' };

const game = (overrides: Partial<CatalogHighlight>): CatalogHighlight => ({
  provider: 'igdb',
  externalId: '1',
  name: 'Game',
  releaseDate: '2026-09-15',
  coverUrl: '/api/catalog/igdb/images/co1?size=cover',
  artworkUrl: null,
  platforms: [ps5, pc],
  ...overrides,
});

const highlights: CatalogHighlights = {
  recent: [
    game({
      externalId: '500',
      name: 'Wolverine',
      artworkUrl: '/api/catalog/igdb/images/arw?size=artwork',
    }),
    game({ externalId: '501', name: 'Pragmata', releaseDate: '2026-04-17' }),
  ],
  upcoming: [game({ externalId: '600', name: 'Fable', releaseDate: '2027-02-23' })],
  catalogAvailable: true,
};

function renderHome(body: CatalogHighlights | null = highlights) {
  const api = mockApi({
    'GET /auth/me': () => ({ status: 200, body: testUser }),
    'GET /catalog/highlights': () =>
      body ? { status: 200, body } : { status: 503, body: { code: 'CATALOG_UNAVAILABLE' } },
  });
  return { ...api, ...renderRoute('/') };
}

describe('Home showcase', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the main message and entry points', async () => {
    renderHome();

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Tu historial personal de videojuegos',
      }),
    ).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(within(main).getByRole('button', { name: 'Explorar juegos' })).toBeInTheDocument();
    expect(within(main).getByRole('link', { name: 'Mis juegos' })).toHaveAttribute(
      'href',
      '/games',
    );
  });

  it('features a game with artwork in the hero, linking to its catalog page', async () => {
    const { router } = renderHome();

    const featured = await screen.findByRole('link', { name: /En portada: Wolverine/ });
    expect(featured).toHaveAttribute('href', '/catalog/igdb/500');

    await userEvent.click(featured);
    await waitFor(() => expect(router.state.location.pathname).toBe('/catalog/igdb/500'));
  });

  it('shows recent releases as ranked posters linking to the catalog', async () => {
    renderHome();

    const rail = await screen.findByRole('region', { name: 'Lanzamientos recientes' });
    await within(rail).findByText('Pragmata');
    const items = within(rail).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByLabelText('Puesto 1')).toBeInTheDocument();
    expect(within(items[1]).getByRole('link')).toHaveAttribute('href', '/catalog/igdb/501');
    expect(within(items[1]).getByText('2026 · PS5 · PC')).toBeInTheDocument();
  });

  it('shows upcoming releases with their release date', async () => {
    renderHome();

    const rail = await screen.findByRole('region', { name: 'Próximamente' });
    const card = await within(rail).findByRole('link', { name: /Fable/ });
    expect(card).toHaveAttribute('href', '/catalog/igdb/600');
    expect(
      within(card).getByLabelText(`Sale el ${calendarParts('2027-02-23').long}`),
    ).toBeInTheDocument();
  });

  it('presents the features and the three steps', async () => {
    renderHome();

    const features = await screen.findByRole('region', {
      name: 'Todo tu historial, en un solo lugar',
    });
    for (const title of [
      'Partidas',
      'Tiempo jugado',
      'Dificultad',
      'Platino',
      'Valoración',
      'Notas',
    ]) {
      expect(within(features).getByRole('heading', { level: 3, name: title })).toBeInTheDocument();
    }
    const steps = screen.getByRole('region', { name: 'Empezá en tres pasos' });
    expect(within(steps).getAllByRole('listitem')).toHaveLength(3);
  });

  it('degrades gracefully when the catalog is unavailable', async () => {
    renderHome(null);

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Tu historial personal de videojuegos',
      }),
    ).toBeInTheDocument();
    // 5xx errors are retried once before giving up.
    await waitFor(
      () =>
        expect(
          screen.queryByRole('region', { name: 'Lanzamientos recientes' }),
        ).not.toBeInTheDocument(),
      { timeout: 5000 },
    );
    expect(screen.queryByRole('region', { name: 'Próximamente' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /En portada/ })).not.toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Todo tu historial, en un solo lugar' }),
    ).toBeInTheDocument();
  });
});

describe('pickFeatured', () => {
  const withArt = (id: string) => game({ externalId: id, artworkUrl: `/a/${id}` });

  it('only picks games with artwork, varying with the seed', () => {
    const games = [game({ externalId: 'x' }), withArt('a'), withArt('b'), withArt('c')];

    expect(pickFeatured(games, 0)?.externalId).toBe('a');
    expect(pickFeatured(games, 0.5)?.externalId).toBe('b');
    expect(pickFeatured(games, 0.99)?.externalId).toBe('c');
  });

  it('returns null when no game has artwork', () => {
    expect(pickFeatured([game({})], 0.3)).toBeNull();
    expect(pickFeatured([], 0.3)).toBeNull();
  });
});
