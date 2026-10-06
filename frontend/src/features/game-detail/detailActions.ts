import type { Difficulty, GamingSession, Playthrough } from '../library/types';

/** Actions that open a dialog on the detail page (one at a time). */
export type DetailAction =
  | { type: 'editGame' }
  | { type: 'deleteGame' }
  | { type: 'newPlaythrough' }
  | { type: 'editPlaythrough'; playthrough: Playthrough }
  | { type: 'deletePlaythrough'; playthrough: Playthrough }
  | { type: 'manualTime'; playthrough: Playthrough }
  | { type: 'timeMode'; playthrough: Playthrough }
  | { type: 'newSession'; playthroughId?: string }
  | { type: 'editSession'; session: GamingSession }
  | { type: 'deleteSession'; session: GamingSession }
  | { type: 'platinum' }
  | { type: 'renameDifficulty'; difficulty: Difficulty }
  | { type: 'deleteDifficulty'; difficulty: Difficulty };

export type OnDetailAction = (action: DetailAction) => void;

export const DIFFICULTIES_SECTION_ID = 'dificultades';
