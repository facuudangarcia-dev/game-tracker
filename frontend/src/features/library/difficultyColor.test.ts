import { describe, expect, it } from 'vitest';
import { difficultyColor, difficultyLevel } from './difficultyColor';
import type { Difficulty } from './types';

describe('difficulty colors', () => {
  it('goes from light green (easiest) to very dark red (hardest)', () => {
    expect(difficultyColor(0, 3)).toBe('hsl(125, 62%, 68%)');
    expect(difficultyColor(1, 3)).toBe('hsl(63, 71%, 49%)');
    expect(difficultyColor(2, 3)).toBe('hsl(0, 80%, 30%)');
    // Same ends for any length; a one-item list is the easiest.
    expect(difficultyColor(0, 6)).toBe(difficultyColor(0, 3));
    expect(difficultyColor(5, 6)).toBe(difficultyColor(2, 3));
    expect(difficultyColor(0, 1)).toBe(difficultyColor(0, 3));
  });

  it('finds the place of a difficulty in its own list', () => {
    const list: Difficulty[] = [
      { id: 'a', kind: 'PLATINUM', name: 'Fácil', position: 0, inUse: false },
      { id: 'b', kind: 'PLAYTHROUGH', name: 'Fácil', position: 0, inUse: false },
      { id: 'c', kind: 'PLAYTHROUGH', name: 'Difícil', position: 1, inUse: true },
    ];
    expect(difficultyLevel(list, 'PLAYTHROUGH', 'c')).toEqual({ level: 1, levels: 2 });
    expect(difficultyLevel(list, 'PLAYTHROUGH', 'a')).toBeNull();
    expect(difficultyLevel(list, 'PLAYTHROUGH', undefined)).toBeNull();
  });
});
