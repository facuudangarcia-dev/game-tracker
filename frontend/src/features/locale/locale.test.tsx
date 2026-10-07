import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { genreName } from '../../i18n/genres';
import { getLocale, setLocale } from '../../i18n/locale';
import { dictionaries, messages } from '../../i18n/messages';
import { formatDate } from '../../lib/format';
import { mockApi, testUser, unauthenticated } from '../../test/mockApi';
import { renderRoute } from '../../test/renderRoute';

/** Same keys, array lengths and value kinds in every locale. */
function shapeOf(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(shapeOf);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shapeOf(v)]));
  }
  return typeof value;
}

describe('language', () => {
  afterEach(() => {
    setLocale('es');
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('has complete dictionaries with the same shape', () => {
    expect(shapeOf(dictionaries.en)).toEqual(shapeOf(dictionaries.es));
  });

  it('switches the whole interface from the header and remembers the choice', async () => {
    mockApi({ 'GET /auth/me': () => ({ status: 200, body: testUser }) });
    const { router } = renderRoute('/');

    await userEvent.click(
      await screen.findByRole('button', { name: 'Idioma: Español. Cambiar idioma' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'English' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your personal video game history' }),
    ).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByRole('link', { name: 'My games' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Language: English. Change language' }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe('/');
    expect(getLocale()).toBe('en');
    expect(window.localStorage.getItem('gt.locale')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it.each(['/', '/games', '/profile'])('leaves no Spanish text on %s in English', async (path) => {
    setLocale('en');
    mockApi({ 'GET /auth/me': () => ({ status: 200, body: testUser }) });
    renderRoute(path);

    await screen.findByRole('navigation', { name: 'Main navigation' });
    await waitFor(() => expect(screen.queryByText(messages.app.loading)).not.toBeInTheDocument());
    const text = document.body.textContent ?? '';
    for (const spanish of ['Inicio', 'Mis juegos', 'Mi perfil', 'Explorar', 'Buscar', 'Cerrar']) {
      expect(text).not.toContain(spanish);
    }
  });

  it('is available on the login page too', async () => {
    mockApi({ 'GET /auth/me': unauthenticated });
    renderRoute('/login');

    await userEvent.click(
      await screen.findByRole('button', { name: 'Idioma: Español. Cambiar idioma' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'English' }));

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });

  it('formats dates and genres in the current language', () => {
    expect(formatDate('2026-10-05')).toBe('05/10/2026');
    expect(genreName({ slug: 'adventure', name: 'Aventura' })).toBe('Aventura');

    setLocale('en');

    expect(formatDate('2026-10-05')).toBe('10/05/2026');
    expect(genreName({ slug: 'adventure', name: 'Aventura' })).toBe('Adventure');
    // Genres created on import keep the provider's name.
    expect(genreName({ slug: null, name: 'Superhero' })).toBe('Superhero');
  });
});
