import type { Difficulty, DifficultyKind } from './types';

/**
 * Color of a difficulty by its place in its game's list (decision #72): from a
 * light green (the easiest) through yellow and orange to a very dark red (the
 * hardest), spread evenly however long the list is.
 */
export function difficultyColor(level: number, levels: number): string {
  const t = levels <= 1 ? 0 : Math.min(Math.max(level / (levels - 1), 0), 1);
  const hue = Math.round(125 * (1 - t));
  const saturation = Math.round(62 + 18 * t);
  const lightness = Math.round(68 - 38 * t);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/** Place of a difficulty in its game's list, or null when it isn't there. */
export function difficultyLevel(
  difficulties: Difficulty[],
  kind: DifficultyKind,
  id: string | undefined,
): { level: number; levels: number } | null {
  const list = difficulties.filter((d) => d.kind === kind);
  const level = list.findIndex((d) => d.id === id);
  return level === -1 ? null : { level, levels: list.length };
}
