import { getDb } from './database';

export interface WeekStatRow {
  league_id: number;
  season: number;
  matchday: number;
  matches_total: number;
  matches_with_ht: number;
  /** IY ev sahibi onde, MS deplasman galibi. */
  count_12: number;
  /** IY deplasman onde, MS ev sahibi galibi. */
  count_21: number;
  updated_at: number;
}

/** Guncel sezon: her acilista yeniden hesaplanir. Eski sezonlar bir kez hesaplanip saklanir. */
export const CURRENT_SEASON = 2026;

/** En az bir macinda IY skoru olan sezonlar (yeni -> eski). */
export async function getSeasonsWithHt(): Promise<number[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ season: number }>(
    `SELECT DISTINCT season FROM matches
     WHERE ht_home IS NOT NULL AND ht_away IS NOT NULL ORDER BY season DESC`,
  );
  return rows.map((r) => r.season);
}

/** Sezon icin week_stats hazir degilse (ya da guncel sezonsa) yeniden uretir. */
export async function ensureWeekStats(season: number): Promise<void> {
  if (season < CURRENT_SEASON) {
    const db = await getDb();
    const row = await db.getFirstAsync<{ c: number }>(
      `SELECT COUNT(*) AS c FROM week_stats WHERE season = ?`,
      [season],
    );
    if ((row?.c ?? 0) > 0) return;
  }
  await refreshWeekStats(season);
}

/**
 * matches tablosundan bir sezonun bitmis maclarini lig x hafta bazinda ozetleyip
 * week_stats tablosuna yazar (hafta: kaynakta varsa matchday, yoksa turetilir).
 */
export async function refreshWeekStats(season: number): Promise<void> {
  const db = await getDb();
  const matches = await db.getAllAsync<{
    league_id: number;
    matchday: number | null;
    home_team_id: string;
    away_team_id: string;
    ht_home: number | null;
    ht_away: number | null;
    ft_home: number | null;
    ft_away: number | null;
  }>(
    `SELECT league_id, matchday, home_team_id, away_team_id,
            ht_home, ht_away, ft_home, ft_away
     FROM matches
     WHERE season = ? AND status = 'finished'
     ORDER BY league_id, utc_date`,
    [season],
  );

  // Hafta: kaynakta matchday varsa o, yoksa iki takimdan "kacinci macini oynadigi"
  // buyuk olan (bkz. utils/rounds.ts ile ayni kural).
  const played = new Map<string, number>(); // "lig:takim" -> oynanan mac sayisi
  const agg = new Map<string, WeekStatRow>();
  const now = Date.now();

  for (const m of matches) {
    const hk = `${m.league_id}:${m.home_team_id}`;
    const ak = `${m.league_id}:${m.away_team_id}`;
    const homeNth = (played.get(hk) ?? 0) + 1;
    const awayNth = (played.get(ak) ?? 0) + 1;
    played.set(hk, homeNth);
    played.set(ak, awayNth);
    const week = m.matchday ?? Math.max(homeNth, awayNth);

    const key = `${m.league_id}:${week}`;
    let row = agg.get(key);
    if (!row) {
      row = {
        league_id: m.league_id,
        season,
        matchday: week,
        matches_total: 0,
        matches_with_ht: 0,
        count_12: 0,
        count_21: 0,
        updated_at: now,
      };
      agg.set(key, row);
    }
    row.matches_total++;
    if (m.ht_home != null && m.ht_away != null && m.ft_home != null && m.ft_away != null) {
      row.matches_with_ht++;
      if (m.ht_home > m.ht_away && m.ft_home < m.ft_away) row.count_12++;
      if (m.ht_home < m.ht_away && m.ft_home > m.ft_away) row.count_21++;
    }
  }

  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM week_stats WHERE season = ?`, [season]);
    for (const r of agg.values()) {
      await db.runAsync(
        `INSERT INTO week_stats
           (league_id, season, matchday, matches_total, matches_with_ht,
            count_12, count_21, updated_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        [
          r.league_id, r.season, r.matchday, r.matches_total,
          r.matches_with_ht, r.count_12, r.count_21, r.updated_at,
        ],
      );
    }
  });
}

export async function getWeekStats(season: number): Promise<WeekStatRow[]> {
  const db = await getDb();
  return db.getAllAsync<WeekStatRow>(
    `SELECT * FROM week_stats WHERE season = ? ORDER BY league_id, matchday`,
    [season],
  );
}
