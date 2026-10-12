import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi, testUser } from '../../test/mockApi';
import { renderRoute } from '../../test/renderRoute';
import type { SteamAccount, SteamPendingGame, SteamStatus } from './api';

const account = (overrides: Partial<SteamAccount> = {}): SteamAccount => ({
  personaName: 'Gabe',
  linkedAt: '2026-10-10T10:00:00.000Z',
  lastSyncedAt: '2026-10-10T10:05:00.000Z',
  syncing: false,
  syncError: null,
  progress: { done: 12, total: 12 },
  importedGames: 12,
  pendingGames: 0,
  ...overrides,
});

const status = (overrides: Partial<SteamStatus> = {}): SteamStatus => ({
  configured: true,
  account: null,
  excluded: [],
  ...overrides,
});

function setup(steam: SteamStatus, handlers: Parameters<typeof mockApi>[0] = {}, path = '/games') {
  const api = mockApi({
    'GET /auth/me': () => ({ status: 200, body: testUser }),
    'GET /steam': () => ({ status: 200, body: steam }),
    'POST /steam/sync': () => ({ status: 200, body: steam }),
    ...handlers,
  });
  return { ...api, ...renderRoute(path) };
}

describe('Steam on "Mis juegos"', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is hidden when Steam is not configured', async () => {
    setup(status({ configured: false }));
    await screen.findByRole('heading', { name: 'Mis juegos' });
    expect(screen.queryByRole('region', { name: 'Steam' })).not.toBeInTheDocument();
  });

  it("offers to link the account through Steam's login", async () => {
    const { calls } = setup(status());

    const panel = await screen.findByRole('region', { name: 'Steam' });
    expect(within(panel).getByText('Conectá tu cuenta de Steam')).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Vincular Steam' })).toHaveAttribute(
      'href',
      '/api/steam/link',
    );
    // Nothing to sync without an account.
    expect(calls.some((c) => c.path === '/steam/sync')).toBe(false);
  });

  it('syncs automatically on opening and on demand, explaining the cooldown', async () => {
    let manual = 0;
    const { calls } = setup(status({ account: account() }), {
      'POST /steam/sync': (request) => {
        if ((request.body as { auto: boolean }).auto) {
          return { status: 200, body: status({ account: account() }) };
        }
        manual++;
        return manual === 1
          ? { status: 200, body: status({ account: account() }) }
          : { status: 429, body: { code: 'STEAM_SYNC_COOLDOWN' } };
      },
    });

    const panel = await screen.findByRole('region', { name: 'Steam' });
    expect(within(panel).getByText('Steam: Gabe')).toBeInTheDocument();
    expect(within(panel).getByText(/Última sincronización/)).toBeInTheDocument();
    await waitFor(() =>
      expect(calls.filter((c) => c.path === '/steam/sync').map((c) => c.body)).toEqual([
        { auto: true },
      ]),
    );

    await userEvent.click(within(panel).getByRole('button', { name: 'Sincronizar ahora' }));
    await userEvent.click(within(panel).getByRole('button', { name: 'Sincronizar ahora' }));
    expect(
      await within(panel).findByText('Esperá unos minutos entre sincronizaciones.'),
    ).toBeInTheDocument();
  });

  it('shows the progress of a running sync and refreshes the library when it ends', async () => {
    let syncing = true;
    const current = () =>
      status({ account: account({ syncing, progress: { done: 3, total: 10 } }) });
    const { calls } = setup(current(), {
      'GET /steam': () => ({ status: 200, body: current() }),
      'POST /steam/sync': () => ({ status: 200, body: current() }),
    });

    const panel = await screen.findByRole('region', { name: 'Steam' });
    expect(within(panel).getByText('Sincronizando con Steam… 3 de 10 juegos')).toBeInTheDocument();
    expect(within(panel).getByRole('progressbar', { name: /Sincronizando/ })).toHaveAttribute(
      'aria-valuenow',
      '30',
    );

    const libraryCalls = () => calls.filter((c) => c.path.startsWith('/library')).length;
    const before = libraryCalls();
    syncing = false;
    await waitFor(
      () =>
        expect(
          within(panel).queryByRole('progressbar', { name: /Sincronizando/ }),
        ).not.toBeInTheDocument(),
      {
        timeout: 4000,
      },
    );
    await waitFor(() => expect(libraryCalls()).toBeGreaterThan(before));
  });

  describe('reviewing the games found', () => {
    const found: SteamPendingGame[] = [
      {
        appId: 620,
        name: 'Portal 2',
        minutes: 600,
        coverUrl: null,
        manual: false,
        inLibrary: true,
      },
      {
        appId: 999,
        name: 'Tiny Indie',
        minutes: 90,
        coverUrl: null,
        manual: true,
        inLibrary: false,
      },
      {
        appId: 400,
        name: 'Portal',
        minutes: 120,
        coverUrl: null,
        manual: false,
        inLibrary: false,
      },
    ];

    it('opens by itself with every game selected and adds the chosen ones', async () => {
      const { calls } = setup(status({ account: account({ pendingGames: 3 }) }), {
        'GET /steam/pending': () => ({ status: 200, body: found }),
        'POST /steam/pending': () => ({
          status: 200,
          body: status({ account: account({ syncing: true }) }),
        }),
      });

      const dialog = await screen.findByRole('dialog', { name: 'Juegos encontrados en Steam' });
      expect(await within(dialog).findByText('3 de 3 seleccionados')).toBeInTheDocument();
      expect(within(dialog).getAllByRole('checkbox', { checked: true })).toHaveLength(3);
      expect(
        within(dialog).getByText('Ya está en tu biblioteca: se suman las horas y logros de Steam'),
      ).toBeInTheDocument();
      expect(within(dialog).getByText('Manual: no está en el catálogo')).toBeInTheDocument();

      await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Tiny Indie' }));
      expect(within(dialog).getByText('2 de 3 seleccionados')).toBeInTheDocument();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Agregar 2 juegos' }));
      await waitFor(() =>
        expect(calls.find((c) => c.method === 'POST' && c.path === '/steam/pending')?.body).toEqual(
          { appIds: [620, 400] },
        ),
      );
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('shows the games added right away, even when the import already ended', async () => {
      const { calls } = setup(status({ account: account({ pendingGames: 3 }) }), {
        'GET /steam/pending': () => ({ status: 200, body: found }),
        'POST /steam/pending': () => ({ status: 200, body: status({ account: account() }) }),
      });

      const dialog = await screen.findByRole('dialog');
      const libraryCalls = () => calls.filter((c) => c.path.startsWith('/library')).length;
      await within(dialog).findByText('3 de 3 seleccionados');
      const before = libraryCalls();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Agregar 3 juegos' }));
      await waitFor(() => expect(libraryCalls()).toBeGreaterThan(before));
    });

    it('can deselect every game and be opened again from the panel', async () => {
      const { calls } = setup(status({ account: account({ pendingGames: 3 }) }), {
        'GET /steam/pending': () => ({ status: 200, body: found }),
        'POST /steam/pending': () => ({ status: 200, body: status({ account: account() }) }),
      });

      let dialog = await screen.findByRole('dialog');
      await within(dialog).findByText('3 de 3 seleccionados');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cerrar' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

      const panel = screen.getByRole('region', { name: 'Steam' });
      expect(
        within(panel).getByText('Encontramos 3 juegos de Steam para revisar.'),
      ).toBeInTheDocument();
      await userEvent.click(within(panel).getByRole('button', { name: 'Revisar' }));
      dialog = await screen.findByRole('dialog');
      await userEvent.click(
        await within(dialog).findByRole('button', { name: 'Deseleccionar todos' }),
      );
      expect(within(dialog).getByText('0 de 3 seleccionados')).toBeInTheDocument();
      await userEvent.click(within(dialog).getByRole('button', { name: 'No agregar ninguno' }));
      await waitFor(() =>
        expect(calls.find((c) => c.method === 'POST' && c.path === '/steam/pending')?.body).toEqual(
          { appIds: [] },
        ),
      );
    });

    it('waits for the sync to end', async () => {
      setup(status({ account: account({ pendingGames: 3, syncing: true }) }));
      await screen.findByRole('region', { name: 'Steam' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('explains a private profile', async () => {
    setup(status({ account: account({ syncError: 'PRIVATE_PROFILE' }) }));
    expect(await screen.findByText(/Tu perfil de Steam es privado/)).toBeInTheDocument();
  });

  it("shows the result of Steam's login while looking for the games", async () => {
    setup(
      status({ account: account({ syncing: true, lastSyncedAt: null }) }),
      {},
      '/games?steam=linked',
    );
    expect(
      await screen.findByText('Steam vinculado. Estamos buscando tus juegos…'),
    ).toBeInTheDocument();
  });

  it('hides the login notice once the search ends with nothing to review', async () => {
    setup(status({ account: account({ pendingGames: 0 }) }), {}, '/games?steam=linked');
    await screen.findByRole('region', { name: 'Steam' });
    await waitFor(() =>
      expect(
        screen.queryByText('Steam vinculado. Estamos buscando tus juegos…'),
      ).not.toBeInTheDocument(),
    );
  });

  it('hides the login notice when the games found are reviewed', async () => {
    setup(
      status({ account: account({ pendingGames: 1 }) }),
      {
        'GET /steam/pending': () => ({
          status: 200,
          body: [
            {
              appId: 620,
              name: 'Portal 2',
              minutes: 600,
              coverUrl: null,
              manual: false,
              inLibrary: false,
            },
          ],
        }),
        'POST /steam/pending': () => ({ status: 200, body: status({ account: account() }) }),
      },
      '/games?steam=linked',
    );
    const notice = 'Steam vinculado. Estamos buscando tus juegos…';
    expect(await screen.findByText(notice)).toBeInTheDocument();
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Agregar 1 juego' }));
    await waitFor(() => expect(screen.queryByText(notice)).not.toBeInTheDocument());
  });

  it('explains why linking failed', async () => {
    setup(status(), {}, '/games?steam=error&reason=STEAM_ACCOUNT_IN_USE');
    expect(
      await screen.findByText('Esa cuenta de Steam ya está vinculada a otro usuario.'),
    ).toBeInTheDocument();
  });

  it('restores removed games and unlinks after confirming', async () => {
    const { calls } = setup(
      status({ account: account(), excluded: [{ appId: 999, name: 'Tiny Indie' }] }),
      {
        'DELETE /steam/excluded/999': () => ({ status: 200, body: status({ account: account() }) }),
        'DELETE /steam?deleteGames=false': () => ({ status: 204 }),
      },
    );

    const panel = await screen.findByRole('region', { name: 'Steam' });
    expect(within(panel).getByText('1 juego de Steam quitado')).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole('button', { name: 'Restaurar Tiny Indie' }));
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'DELETE' && c.path === '/steam/excluded/999')).toBe(
        true,
      ),
    );

    await userEvent.click(within(panel).getByRole('button', { name: 'Desvincular' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('radio', { name: /Dejar los juegos/ })).toBeChecked();
    expect(within(dialog).getByText(/quedan en Mis juegos/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Desvincular' }));
    await waitFor(() =>
      expect(
        calls.some((c) => c.method === 'DELETE' && c.path === '/steam?deleteGames=false'),
      ).toBe(true),
    );
  });

  it('can delete the games Steam added when unlinking', async () => {
    const { calls } = setup(status({ account: account({ importedGames: 40 }) }), {
      'DELETE /steam?deleteGames=true': () => ({ status: 204 }),
    });

    const panel = await screen.findByRole('region', { name: 'Steam' });
    await userEvent.click(within(panel).getByRole('button', { name: 'Desvincular' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      within(dialog).getByRole('radio', { name: /Borrar los 40 juegos que trajo Steam/ }),
    );
    expect(
      within(dialog).getByText(/ya tenías en PC antes de vincular quedan/),
    ).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Desvincular' }));
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'DELETE' && c.path === '/steam?deleteGames=true')).toBe(
        true,
      ),
    );
  });
});
