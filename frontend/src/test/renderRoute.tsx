import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '../app/AppProviders';
import { createQueryClient } from '../app/queryClient';
import { routes } from '../app/routes';

/** Renders the real route tree at `path` with all app providers. */
export function renderRoute(path = '/') {
  const queryClient = createQueryClient();
  const router = createMemoryRouter(routes, { initialEntries: [path] });

  return {
    router,
    queryClient,
    ...render(
      <AppProviders queryClient={queryClient}>
        <RouterProvider router={router} />
      </AppProviders>,
    ),
  };
}
