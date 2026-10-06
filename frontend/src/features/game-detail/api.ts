import { apiFetch } from '../../lib/api/client';
import type {
  Difficulty,
  DifficultyKind,
  PlayStatus,
  TimeMode,
  UserGameDetails,
} from '../library/types';

const base = (userGameId: string) => `/library/${userGameId}`;
const send = <T>(path: string, method: string, body?: unknown) =>
  apiFetch<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

export interface UserGameChanges {
  rating?: number | null;
  notes?: string | null;
}

export interface PlaythroughChanges {
  name?: string | null;
  status?: PlayStatus;
  difficultyId?: string | null;
  startDate?: string | null;
  completionDate?: string | null;
  notes?: string | null;
}

export interface SessionInput {
  playedAt: string;
  durationMinutes: number;
  notes?: string | null;
}

export interface PlatinumInput {
  achieved: boolean;
  date?: string | null;
  timeMinutes?: number | null;
  difficultyId?: string | null;
}

/** Every mutation of a game returns the updated UserGame (or its difficulty lists). */
export const detailApi = {
  updateGame: (id: string, changes: UserGameChanges) =>
    send<UserGameDetails>(base(id), 'PATCH', changes),
  deleteGame: (id: string) => send<unknown>(base(id), 'DELETE'),

  createPlaythrough: (id: string, input: PlaythroughChanges) =>
    send<UserGameDetails>(`${base(id)}/playthroughs`, 'POST', input),
  updatePlaythrough: (id: string, playthroughId: string, changes: PlaythroughChanges) =>
    send<UserGameDetails>(`${base(id)}/playthroughs/${playthroughId}`, 'PATCH', changes),
  deletePlaythrough: (id: string, playthroughId: string) =>
    send<UserGameDetails>(`${base(id)}/playthroughs/${playthroughId}`, 'DELETE'),

  setManualTime: (id: string, playthroughId: string, minutes: number) =>
    send<UserGameDetails>(`${base(id)}/playthroughs/${playthroughId}/manual-time`, 'PUT', {
      minutes,
    }),
  changeTimeMode: (
    id: string,
    playthroughId: string,
    mode: TimeMode,
    initialSession?: { playedAt: string },
  ) =>
    send<UserGameDetails>(`${base(id)}/playthroughs/${playthroughId}/time-mode`, 'PUT', {
      mode,
      initialSession,
    }),

  createSession: (id: string, playthroughId: string, input: SessionInput) =>
    send<UserGameDetails>(`${base(id)}/playthroughs/${playthroughId}/sessions`, 'POST', input),
  updateSession: (id: string, sessionId: string, input: Partial<SessionInput>) =>
    send<UserGameDetails>(`${base(id)}/sessions/${sessionId}`, 'PATCH', input),
  deleteSession: (id: string, sessionId: string) =>
    send<UserGameDetails>(`${base(id)}/sessions/${sessionId}`, 'DELETE'),

  updatePlatinum: (id: string, input: PlatinumInput) =>
    send<UserGameDetails>(`${base(id)}/platinum`, 'PUT', input),

  createDifficulty: (id: string, kind: DifficultyKind, name: string) =>
    send<Difficulty[]>(`${base(id)}/difficulties`, 'POST', { kind, name }),
  renameDifficulty: (id: string, difficultyId: string, name: string) =>
    send<Difficulty[]>(`${base(id)}/difficulties/${difficultyId}`, 'PATCH', { name }),
  deleteDifficulty: (id: string, difficultyId: string) =>
    send<Difficulty[]>(`${base(id)}/difficulties/${difficultyId}`, 'DELETE'),
  reorderDifficulties: (id: string, kind: DifficultyKind, ids: string[]) =>
    send<Difficulty[]>(`${base(id)}/difficulties/order`, 'PUT', { kind, ids }),
};
