import { getLocale } from './locale';
import type { Locale } from './messages';

/**
 * Names of the seeded genres (docs/decisions.md #25) in locales other than Spanish,
 * by slug. The API returns the Spanish name; genres created on import already carry
 * the provider's (English) name and are shown as they are.
 */
const GENRE_NAMES: Partial<Record<Locale, Record<string, string>>> = {
  en: {
    'point-and-click': 'Point-and-click',
    fighting: 'Fighting',
    shooter: 'Shooter',
    music: 'Music',
    platform: 'Platform',
    puzzle: 'Puzzle',
    racing: 'Racing',
    'real-time-strategy': 'Real-time strategy (RTS)',
    'role-playing': 'Role-playing (RPG)',
    simulator: 'Simulator',
    sport: 'Sport',
    strategy: 'Strategy',
    'turn-based-strategy': 'Turn-based strategy (TBS)',
    tactical: 'Tactical',
    'hack-and-slash': "Hack and slash / Beat 'em up",
    'quiz-trivia': 'Quiz / Trivia',
    pinball: 'Pinball',
    adventure: 'Adventure',
    indie: 'Indie',
    arcade: 'Arcade',
    'visual-novel': 'Visual novel',
    'card-and-board': 'Card & board game',
    moba: 'MOBA',
  },
};

/** Display name of a genre in the current locale. */
export function genreName(genre: { slug?: string | null; name: string }): string {
  return (genre.slug && GENRE_NAMES[getLocale()]?.[genre.slug]) || genre.name;
}
