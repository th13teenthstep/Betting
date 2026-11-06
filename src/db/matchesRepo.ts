import { getDb } from './database';
import { hashId } from '../utils/hashId';
import type { Fixture, FixtureOdds } from '../types/football';
import type { TsaMatch } from '../types/thestatsapi';

export interface MatchRow {
  id: string;
  competition_id: string | null;
  season_id: string | null;
  league_id: number;
  season: number;
  matchday: number | null;
  utc_date: string;
  status: string;
  home_team_id: string;
  home_team_name: string;
  away_team_id: string;
  away_team_name: string;
  ft_home: number | null;
  ft_away: number | null;
  winner: string | null;
  ht_home: number | null;
  ht_away: number | null;
  ht_fetched_at: number | null;
  odds_json: string | null;
  odds_fetched_at: number | null;
}

export interface MatchInsert {
  id: string;
  competition_id: string | null;
  season_id: string | null;
  league_id: number;
  season: number;
  matchday: number | null;
  utc_date: string;
  status: string;
  home_team_id: string;
  home_team_name: string;
  away_team_id: string;
  away_team_name: string;
  ft_home: number | null;
  ft_away: number | null;
  winner: string | null;
}

export function toMatchInsert(
  m: TsaMatch,
  leagueId: number,
  season: number,
): MatchInsert {
  return {
    id: m.id,
    competition_id: m.competition_id,
    season_id: m.season_id,
    league_id: leagueId,
    season,
    matchday: m.matchday,
    utc_date: m.utc_date,
    status: m.status,
    home_team_id: m.home_team.id,
    home_team_name: m.home_team.name,
    away_team_id: m.away_team.id,
    away_team_name: m.away_team.name,
    ft_home: m.score.home,
    ft_away: m.score.away,
    winner: m.score.winner,
  };
}

export async function upsertMatches(rows: MatchInsert[]): Promise<void> {
  if (rows.length === 0) return;
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const m of rows) {
      await db.runAsync(
        `INSERT INTO matches (
           id, competition_id, season_id, league_id, season, matchday,
           utc_date, status, home_team_id, home_team_name, away_team_id,
           away_team_name, ft_home, ft_away, winner
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           ft_home = excluded.ft_home,
           ft_away = excluded.ft_away,
           winner = excluded.winner,
           utc_date = excluded.utc_date,
           matchday = excluded.matchday`,
        [
          m.id, m.competition_id, m.season_id, m.league_id, m.season, m.matchday,
          m.utc_date, m.status, m.home_team_id, m.home_team_name, m.away_team_id,
          m.away_team_name, m.ft_home, m.ft_away, m.winner,
        ],
      );
    }
  });
}

/** Belirli bir competition/season icin bilinen (DB'de kayitli) mac id'leri. */
export async function getKnownMatchIds(
  competitionId: string,
  seasonId: string,
  limit = 500,
): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM matches WHERE competition_id = ? AND season_id = ? ORDER BY utc_date DESC LIMIT ?`,
    [competitionId, seasonId, limit],
  );
  return new Set(rows.map((r) => r.id));
}

export async function getMatchesForLeagueSeason(
  leagueId: number,
  season: number,
): Promise<MatchRow[]> {
  const db = await getDb();
  return db.getAllAsync<MatchRow>(
    `SELECT * FROM matches WHERE league_id = ? AND season = ? AND status = 'finished' ORDER BY utc_date DESC`,
    [leagueId, season],
  );
}

/**
 * Dosya kaynakli (tek seferlik import edilmis) bir lig/sezonda bilinen en son
 * bitmis mac tarihi + o sezondaki tum mac tarihleri (API'den gelen yeni maclari
 * dosyadaki maclarla CARPISTIRMAMAK icin tam utc_date eslesmesiyle eleniyor).
 */
export async function getFileLeagueSyncState(
  leagueId: number,
  season: number,
): Promise<{ lastUtcDate: string | null; knownUtcDates: Set<string> }> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ utc_date: string }>(
    `SELECT utc_date FROM matches WHERE league_id = ? AND season = ? AND status = 'finished'`,
    [leagueId, season],
  );
  const knownUtcDates = new Set(rows.map((r) => r.utc_date));
  let lastUtcDate: string | null = null;
  for (const r of rows) {
    if (lastUtcDate == null || r.utc_date > lastUtcDate) lastUtcDate = r.utc_date;
  }
  return { lastUtcDate, knownUtcDates };
}

/** En az bir macinda IY (ilk yari) skoru bulunan lig id'leri. */
export async function getLeagueIdsWithHt(): Promise<Set<number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ league_id: number }>(
    `SELECT DISTINCT league_id FROM matches WHERE ht_home IS NOT NULL AND ht_away IS NOT NULL`,
  );
  return new Set(rows.map((r) => r.league_id));
}

// ---------------------------------------------------------------------------
// Senkron kuyrugu (IY skoru + Bet365 oranlari)
// ---------------------------------------------------------------------------

export interface QueueRow {
  match_id: string;
  needs_ht: number;
  needs_odds: number;
  attempts: number;
  enqueued_at: number;
  /** Dosya kaynakli maclarda API'deki mac id'si; API maclarinda null (match_id zaten API id'si). */
  api_id: string | null;
}

export interface FileMatchNeed {
  id: string;
  utc_date: string;
  home_team_name: string;
  away_team_name: string;
  needsHt: boolean;
  needsOdds: boolean;
}

/**
 * Dosya kaynakli ligde, IY'si ya da kapanis orani eksik VE daha once API'den denenmemis maclar.
 * (`*_fetched_at` dolu = denendi; API'de de yoksa tekrar tekrar denenmesin.)
 */
export async function getFileMatchesNeedingData(
  leagueId: number,
  season: number,
): Promise<FileMatchNeed[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MatchRow>(
    `SELECT * FROM matches
     WHERE league_id = ? AND season = ? AND status = 'finished' AND source = 'file'
       AND ((ht_home IS NULL AND ht_fetched_at IS NULL)
         OR (json_extract(odds_json, '$.home.closing') IS NULL AND odds_fetched_at IS NULL))`,
    [leagueId, season],
  );
  return rows.map((r) => ({
    id: r.id,
    utc_date: r.utc_date,
    home_team_name: r.home_team_name,
    away_team_name: r.away_team_name,
    needsHt: r.ht_home == null && r.ht_fetched_at == null,
    needsOdds: r.odds_fetched_at == null && !hasClosing(r.odds_json),
  }));
}

function hasClosing(oddsJson: string | null): boolean {
  if (!oddsJson) return false;
  try {
    return (JSON.parse(oddsJson) as FixtureOdds).home?.closing != null;
  } catch {
    return false;
  }
}

/** Kuyruktaki dosya kaynakli maclarin (API id'si olanlarin) DB id'leri. */
export async function getQueuedFileMatchIds(): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ match_id: string }>(
    `SELECT match_id FROM sync_queue WHERE api_id IS NOT NULL`,
  );
  return new Set(rows.map((r) => r.match_id));
}

export async function enqueueFileMatches(
  items: { id: string; apiId: string; needsHt: boolean; needsOdds: boolean }[],
): Promise<void> {
  if (items.length === 0) return;
  const db = await getDb();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    for (const it of items) {
      await db.runAsync(
        `INSERT INTO sync_queue (match_id, needs_ht, needs_odds, attempts, enqueued_at, api_id)
         VALUES (?, ?, ?, 0, ?, ?)
         ON CONFLICT(match_id) DO NOTHING`,
        [it.id, it.needsHt ? 1 : 0, it.needsOdds ? 1 : 0, now, it.apiId],
      );
    }
  });
}

/**
 * Dosya kaynakli macin API oranini yazar: API'de Bet365 yoksa (null) mevcut oranlari EZMEZ,
 * sadece "denendi" isaretler.
 */
export async function mergeFileOdds(matchId: string, odds: FixtureOdds | null): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE matches SET odds_json = COALESCE(?, odds_json), odds_fetched_at = ? WHERE id = ?`,
    [odds ? JSON.stringify(odds) : null, Date.now(), matchId],
  );
}

export async function enqueueForSync(matchIds: string[]): Promise<void> {
  if (matchIds.length === 0) return;
  const db = await getDb();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    for (const id of matchIds) {
      await db.runAsync(
        `INSERT INTO sync_queue (match_id, needs_ht, needs_odds, attempts, enqueued_at)
         VALUES (?, 1, 1, 0, ?)
         ON CONFLICT(match_id) DO NOTHING`,
        [id, now],
      );
    }
  });
}

export async function getPendingQueueCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM sync_queue`,
  );
  return row?.c ?? 0;
}

export async function getNextQueueItem(): Promise<QueueRow | null> {
  const db = await getDb();
  return db.getFirstAsync<QueueRow>(
    `SELECT * FROM sync_queue ORDER BY enqueued_at ASC LIMIT 1`,
  );
}

export async function finishQueueItem(
  item: QueueRow,
  result: { htDone: boolean; oddsDone: boolean },
): Promise<void> {
  const db = await getDb();
  const attempts = item.attempts + 1;
  const giveUp = attempts >= 5;

  if ((result.htDone && result.oddsDone) || giveUp) {
    await db.runAsync(`DELETE FROM sync_queue WHERE match_id = ?`, [item.match_id]);
    return;
  }

  await db.runAsync(
    `UPDATE sync_queue SET needs_ht = ?, needs_odds = ?, attempts = ? WHERE match_id = ?`,
    [result.htDone ? 0 : 1, result.oddsDone ? 0 : 1, attempts, item.match_id],
  );
}

export async function updateHt(
  matchId: string,
  htHome: number | null,
  htAway: number | null,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE matches SET ht_home = ?, ht_away = ?, ht_fetched_at = ? WHERE id = ?`,
    [htHome, htAway, Date.now(), matchId],
  );
}

export async function updateOdds(matchId: string, odds: FixtureOdds | null): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE matches SET odds_json = ?, odds_fetched_at = ? WHERE id = ?`,
    [odds ? JSON.stringify(odds) : null, Date.now(), matchId],
  );
}

// ---------------------------------------------------------------------------
// DB satirini -> Fixture
// ---------------------------------------------------------------------------

interface LeagueDisplayMeta {
  name: string;
  country: string;
  logo: string;
  flag: string | null;
}

export function rowToFixture(
  row: MatchRow,
  meta: LeagueDisplayMeta,
): Fixture {
  const winner = row.winner; // 'home' | 'away' | 'draw' | null

  let odds: FixtureOdds | null = null;
  if (row.odds_json) {
    try {
      odds = JSON.parse(row.odds_json) as FixtureOdds;
    } catch {
      odds = null;
    }
  }

  return {
    fixture: {
      id: hashId(row.id),
      referee: null,
      timezone: 'UTC',
      date: row.utc_date,
      venue: { id: null, name: null, city: null },
      status: {
        long: row.status,
        short: row.status === 'finished' ? 'FT' : row.status.toUpperCase(),
        elapsed: null,
      },
    },
    league: {
      id: row.league_id,
      name: meta.name,
      country: meta.country,
      logo: meta.logo,
      flag: meta.flag,
      season: row.season,
      round: row.matchday != null ? `Round ${row.matchday}` : '',
    },
    teams: {
      home: {
        id: hashId(row.home_team_id),
        name: row.home_team_name,
        logo: '',
        winner: winner == null ? null : winner === 'home',
      },
      away: {
        id: hashId(row.away_team_id),
        name: row.away_team_name,
        logo: '',
        winner: winner == null ? null : winner === 'away',
      },
    },
    goals: { home: row.ft_home, away: row.ft_away },
    score: {
      halftime: { home: row.ht_home, away: row.ht_away },
      fulltime: { home: row.ft_home, away: row.ft_away },
      extratime: null,
      penalty: null,
    },
    odds,
  };
}
