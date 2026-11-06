import { getDb } from './database';

export interface TeamReversalStats {
  /** DB takim adi -> bu sezon oynadigi mac sayisi icinde 1/2 veya 2/1 biten maclar. */
  counts: Map<string, number>;
  /** Bu lig/sezonda DB'deki tum takim adlari (sayisi 0 olanlar dahil). */
  teams: string[];
  /** DB takim adi -> DB takim kimligi (TakimMaclari ekranina gitmek icin). */
  teamIds: Map<string, string>;
  /** Lig/sezonda IY verisi var mi? Yoksa sayilar anlamsiz. */
  hasHt: boolean;
}

/**
 * Takim bazinda "bu sezon kac macta 1/2 ya da 2/1 yasandi" (takimin ev ya da deplasman
 * oynamasi fark etmez; mac sonucu 1/2 veya 2/1 olduysa o macin iki takimina da yazilir).
 */
export async function getReversalStatsByTeam(
  leagueId: number,
  season: number,
): Promise<TeamReversalStats> {
  const db = await getDb();

  const reversal = `ht_home IS NOT NULL AND ht_away IS NOT NULL
    AND ft_home IS NOT NULL AND ft_away IS NOT NULL
    AND ((ht_home > ht_away AND ft_home < ft_away) OR (ht_home < ht_away AND ft_home > ft_away))`;
  const base = `league_id = ? AND season = ? AND status = 'finished'`;

  const countRows = await db.getAllAsync<{ team: string; c: number }>(
    `SELECT team, COUNT(*) AS c FROM (
       SELECT home_team_name AS team FROM matches WHERE ${base} AND ${reversal}
       UNION ALL
       SELECT away_team_name AS team FROM matches WHERE ${base} AND ${reversal}
     ) GROUP BY team`,
    [leagueId, season, leagueId, season],
  );

  const teamRows = await db.getAllAsync<{ team: string; id: string }>(
    `SELECT home_team_name AS team, home_team_id AS id FROM matches WHERE league_id = ? AND season = ?
     UNION SELECT away_team_name, away_team_id FROM matches WHERE league_id = ? AND season = ?`,
    [leagueId, season, leagueId, season],
  );

  const htRow = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) AS c FROM matches WHERE ${base} AND ht_home IS NOT NULL`,
    [leagueId, season],
  );

  return {
    counts: new Map(countRows.map((r) => [r.team, r.c])),
    teams: teamRows.map((r) => r.team),
    teamIds: new Map(teamRows.map((r) => [r.team, r.id])),
    hasHt: (htRow?.c ?? 0) > 0,
  };
}
