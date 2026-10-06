import { TtlCache } from './ttl-cache';

describe('TtlCache', () => {
  it('returns values until they expire', () => {
    let now = 0;
    const cache = new TtlCache<string>(1000, 10, () => now);

    cache.set('a', 'value');
    now = 999;
    expect(cache.get('a')).toBe('value');
    now = 1000;
    expect(cache.get('a')).toBeUndefined();
  });

  it('evicts the oldest entries beyond the size cap', () => {
    const cache = new TtlCache<number>(1000, 2, () => 0);

    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });
});
