import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// The first render of a test file (cold module and style compilation) can take
// over a second when the whole suite runs in parallel; the default 1 s wait made
// those tests flaky.
configure({ asyncUtilTimeout: 3000 });

afterEach(() => {
  cleanup();
});
