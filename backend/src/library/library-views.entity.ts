import { ViewColumn, ViewEntity } from 'typeorm';
import type { PlayStatus } from './library.constants';

/**
 * Time of each playthrough in minutes: its previous time plus its Steam time
 * plus the sum of all its sessions (docs/decisions.md #61, #78). Single source
 * of truth for playtime; everything else sums these values.
 */
@ViewEntity({
  name: 'playthrough_times',
  expression: `
    SELECT p.id AS playthrough_id,
           p.user_game_id AS user_game_id,
           (p.previous_time_minutes + p.steam_minutes + COALESCE(
              (SELECT sum(s.duration_minutes) FROM gaming_sessions s WHERE s.playthrough_id = p.id),
              0
            ))::int AS minutes
    FROM playthroughs p
  `,
})
export class PlaythroughTime {
  @ViewColumn({ name: 'playthrough_id' })
  playthroughId: string;

  @ViewColumn({ name: 'user_game_id' })
  userGameId: string;

  @ViewColumn()
  minutes: number;
}

/**
 * Values derived from a UserGame's playthroughs (never stored):
 * - status: IN_PROGRESS if any is in progress, else COMPLETED if any is
 *   completed, else PLAYED if any was played (decision #77), else PENDING;
 * - start date: earliest playthrough start;
 * - completion date: FIRST date any playthrough was completed (not the last);
 * - total minutes: sum of playthrough times.
 * Dates are returned as YYYY-MM-DD text.
 */
@ViewEntity({
  name: 'user_game_summaries',
  dependsOn: [PlaythroughTime],
  expression: `
    SELECT ug.id AS user_game_id,
           CASE
             WHEN bool_or(p.status = 'IN_PROGRESS') THEN 'IN_PROGRESS'
             WHEN bool_or(p.status = 'COMPLETED') THEN 'COMPLETED'
             WHEN bool_or(p.status = 'PLAYED') THEN 'PLAYED'
             ELSE 'PENDING'
           END AS status,
           to_char(min(p.start_date), 'YYYY-MM-DD') AS start_date,
           to_char(min(p.completion_date), 'YYYY-MM-DD') AS completion_date,
           COALESCE(sum(pt.minutes), 0)::int AS total_minutes
    FROM user_games ug
    LEFT JOIN playthroughs p ON p.user_game_id = ug.id
    LEFT JOIN playthrough_times pt ON pt.playthrough_id = p.id
    GROUP BY ug.id
  `,
})
export class UserGameSummary {
  @ViewColumn({ name: 'user_game_id' })
  userGameId: string;

  @ViewColumn()
  status: PlayStatus;

  @ViewColumn({ name: 'start_date' })
  startDate: string | null;

  @ViewColumn({ name: 'completion_date' })
  completionDate: string | null;

  @ViewColumn({ name: 'total_minutes' })
  totalMinutes: number;
}
