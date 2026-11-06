import { getDb } from './database';
import type { MatchRow } from './matchesRepo';
import type { FixtureOdds } from '../types/football';

export interface OddsMatchRow {
  row: MatchRow;
  odds: FixtureOdds | null;
}

/** Bu lig icin DB'de bitmis maci olan sezonlar (yeni -> eski). */
export async function getSeasonsForLeague(leagueId: number): Promise<number[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ season: number }>(
    `SELECT DISTINCT season FROM matches
     WHERE league_id = ? AND status = 'finished' ORDER BY season DESC`,
    [leagueId],
  );
  return rows.map((r) => r.season);
}

/** Bir ligin secili sezonlardaki bitmis maclari + (ayristirilmis) Bet365 oranlari. */
export async function loadSeasonsWithOdds(
  leagueId: number,
  seasons: number[],
): Promise<OddsMatchRow[]> {
  if (seasons.length === 0) return [];
  const db = await getDb();
  const marks = seasons.map(() => '?').join(',');
  const rows = await db.getAllAsync<MatchRow>(
    `SELECT * FROM matches
     WHERE league_id = ? AND season IN (${marks}) AND status = 'finished'
     ORDER BY utc_date DESC`,
    [leagueId, ...seasons],
  );
  return rows.map((row) => {
    let odds: FixtureOdds | null = null;
    if (row.odds_json) {
      try {
        odds = JSON.parse(row.odds_json) as FixtureOdds;
      } catch {
        odds = null;
      }
    }
    return { row, odds };
  });
}

export type OutcomeKey = 'home' | 'draw' | 'away';
export type OddsTriple = Record<OutcomeKey, number | null>;
export const OUTCOME_KEYS: OutcomeKey[] = ['home', 'draw', 'away'];

export interface OddsCriterion {
  /** Hedef oranlar (secili macin oranlari). */
  target: OddsTriple;
  /** Tolerans degeri: +-0.10 gibi sabit oran farki; null = bu kriter kapali. */
  tolerance: number | null;
}

export interface SimilarFilter {
  /** Acilis (1/X/2) kriteri; kendi toleransi var, kapanistan bagimsiz. */
  opening: OddsCriterion;
  /** Kapanis (1/X/2) kriteri; kendi toleransi var, acilistan bagimsiz. */
  closing: OddsCriterion;
}

const EPS = 1e-6;

function within(
  value: number | null | undefined,
  target: number | null,
  tol: number,
): boolean {
  if (target == null) return true; // hedefte oran yoksa o sonuc eslestirmeye katilmaz
  if (value == null) return false;
  return Math.abs(value - target) <= tol + EPS;
}

/**
 * Bir mac, bir kriterin TUM doldurulmus (1/X/2) alanlarini AYNI ANDA (AND) saglamali.
 * Bos birakilan alanlar atlanir (within() target==null ise true doner).
 */
function matchesCriterion(
  kind: 'opening' | 'closing',
  odds: FixtureOdds | null,
  c: OddsCriterion,
): boolean {
  if (c.tolerance == null) return true;
  if (!odds) return false;
  const tol = c.tolerance;
  return OUTCOME_KEYS.every((k) => within(odds[k][kind], c.target[k], tol));
}

/**
 * Verilen oran araliklarina uyan maclar (yeniden eskiye). Acilis ve kapanis BAGIMSIZ
 * kriterlerdir: ikisi de doldurulmussa (tolerans != null) mac HER IKISINI birden saglamali (AND).
 * Bir kriterin toleransi null ise o kriter tamamen atlanir.
 */
export function filterSimilar(all: OddsMatchRow[], f: SimilarFilter): MatchRow[] {
  return all
    .filter(
      (m) => matchesCriterion('opening', m.odds, f.opening) && matchesCriterion('closing', m.odds, f.closing),
    )
    .map((m) => m.row)
    .sort((a, b) => Date.parse(b.utc_date) - Date.parse(a.utc_date));
}

/** Bu ligde acilis oranlari var mi? (dosya kaynakli bazi liglerde sadece kapanis var) */
export function hasOpeningData(all: OddsMatchRow[]): boolean {
  return all.some((m) => m.odds?.home.opening != null);
}

/**
 * "Arayis" sekmesi: lig/sezon ayrimi olmadan TUM bitmis maclar arasinda verilen acilis
 * ve/veya kapanis (1/X/2) kriterlerine uyanlari arar. Performans icin filtre SQL'de
 * (json_extract) yapilir — 70k+ satiri JS'e cekip parse etmeyiz. Bos birakilan (1/X/2)
 * alanlari (target null) o alan icin kriter uygulanmaz, filterSimilar ile ayni mantik.
 */
export async function searchFinishedMatchesByOdds(
  f: SimilarFilter,
  limit: number,
): Promise<{ rows: MatchRow[]; total: number }> {
  const db = await getDb();
  const conditions: string[] = [`status = 'finished'`, `odds_json IS NOT NULL`];
  const params: number[] = [];

  const addCriterion = (kind: 'opening' | 'closing', c: OddsCriterion) => {
    if (c.tolerance == null) return;
    for (const k of OUTCOME_KEYS) {
      const target = c.target[k];
      if (target == null) continue;
      conditions.push(`ABS(json_extract(odds_json, '$.${k}.${kind}') - ?) <= ?`);
      params.push(target, c.tolerance + EPS);
    }
  };
  addCriterion('opening', f.opening);
  addCriterion('closing', f.closing);

  const where = conditions.join(' AND ');
  const totalRow = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) AS c FROM matches WHERE ${where}`,
    params,
  );
  const rows = await db.getAllAsync<MatchRow>(
    `SELECT * FROM matches WHERE ${where} ORDER BY utc_date DESC LIMIT ?`,
    [...params, limit],
  );
  return { rows, total: totalRow?.c ?? 0 };
}
