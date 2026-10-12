import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi, testUser, unauthenticated } from '../../test/mockApi';
import { renderRoute } from '../../test/renderRoute';
import { setColorModePreference } from '../../theme/colorMode';

describe('theme', () => {
  afterEach(() => {
    setColorModePreference('system');
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('switches between light, dark and the system setting and remembers the choice', async () => {
    mockApi({ 'GET /auth/me': () => ({ status: 200, body: testUser }) });
    renderRoute('/');

    await userEvent.click(
      await screen.findByRole('button', { name: 'Tema: Según el sistema. Cambiar tema' }),
    );
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Según el sistema',
      'Claro',
      'Oscuro',
    ]);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Oscuro' }));

    expect(
      await screen.findByRole('button', { name: 'Tema: Oscuro. Cambiar tema' }),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem('gt.theme')).toBe('dark');
    // The page background follows the theme in use.
    expect(getComputedStyle(document.body).backgroundColor).toBe('rgb(15, 17, 21)');

    await userEvent.click(screen.getByRole('button', { name: 'Tema: Oscuro. Cambiar tema' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Claro' }));
    expect(window.localStorage.getItem('gt.theme')).toBe('light');
    expect(getComputedStyle(document.body).backgroundColor).toBe('rgb(243, 245, 250)');
  });

  it('is available without a session', async () => {
    mockApi({ 'GET /auth/me': unauthenticated });
    renderRoute('/login');
    expect(await screen.findByRole('button', { name: /^Tema:/ })).toBeInTheDocument();
  });
});
