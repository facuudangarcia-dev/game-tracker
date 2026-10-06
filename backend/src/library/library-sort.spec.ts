import type { UserGameListItemDto } from './dto/user-game-response.dto';
import { PlayStatus } from './library.constants';
import { sortLibrary } from './library-sort';

function item(id: string, name: string, overrides: Partial<UserGameListItemDto> = {}) {
  return {
    id,
    game: { id: `g-${id}`, name, coverUrl: null, isManual: false },
    platform: { id: 'p', slug: 'pc', name: 'PC', shortName: 'PC' },
    status: PlayStatus.Pending,
    startDate: null,
    completionDate: null,
    totalMinutes: 0,
    rating: null,
    platinumAchieved: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } satisfies UserGameListItemDto;
}

const names = (items: UserGameListItemDto[]) => items.map((i) => i.game.name);

describe('sortLibrary', () => {
  const items = [
    item('1', 'zelda', { rating: 90, totalMinutes: 100, createdAt: '2026-01-03T00:00:00Z' }),
    item('2', 'Ápex', { rating: null, totalMinutes: 300, createdAt: '2026-01-01T00:00:00Z' }),
    item('3', 'Bloodborne', { rating: 95, totalMinutes: 50, createdAt: '2026-01-02T00:00:00Z' }),
    item('4', 'celeste', { rating: null, totalMinutes: 100, createdAt: '2026-01-04T00:00:00Z' }),
  ];

  it('sorts names alphabetically ignoring case and accents', () => {
    expect(names(sortLibrary(items, 'name', 'asc'))).toEqual([
      'Ápex',
      'Bloodborne',
      'celeste',
      'zelda',
    ]);
    expect(names(sortLibrary(items, 'name', 'desc'))).toEqual([
      'zelda',
      'celeste',
      'Bloodborne',
      'Ápex',
    ]);
  });

  it('defaults to most recently added first', () => {
    expect(names(sortLibrary(items))).toEqual(['celeste', 'zelda', 'Bloodborne', 'Ápex']);
  });

  it('keeps unrated games last in both directions', () => {
    expect(names(sortLibrary(items, 'rating', 'desc'))).toEqual([
      'Bloodborne',
      'zelda',
      'Ápex',
      'celeste',
    ]);
    expect(names(sortLibrary(items, 'rating', 'asc'))).toEqual([
      'zelda',
      'Bloodborne',
      'Ápex',
      'celeste',
    ]);
  });

  it('breaks ties by name', () => {
    expect(names(sortLibrary(items, 'totalMinutes', 'desc'))).toEqual([
      'Ápex',
      'celeste',
      'zelda',
      'Bloodborne',
    ]);
  });

  it('keeps games without dates last', () => {
    const dated = [
      item('a', 'A', { completionDate: null }),
      item('b', 'B', { completionDate: '2025-05-01' }),
      item('c', 'C', { completionDate: '2024-01-01' }),
    ];
    expect(names(sortLibrary(dated, 'completionDate', 'asc'))).toEqual(['C', 'B', 'A']);
    expect(names(sortLibrary(dated, 'completionDate', 'desc'))).toEqual(['B', 'C', 'A']);
  });
});
