import axios from 'axios';
import competitions from '../data/apiCompetitions.json';
import { extractBet365Odds } from '../db/oddsMapper';
import { apiGet } from './thestatsapi';
import { getLeagueFixtures } from './fixtureService';
import { getCache, setCache } from '../db/apiCacheRepo';
import type { FixtureOdds } from '../types/football';
import type { TsaMatchDetail, TsaMatchOdds } from '../types/thestatsapi';

const COMPETITIONS = competitions as Record<string, string>;

/** Analiz icin sunulabilen (API karsiligi bilinen) lig id'leri. */
export function hasApiCompetition(leagueId: number): boolean {
  return COMPETITIONS[String(leagueId)] != null;
}

/** Ekranlar arasi geciste serilestirilebilen, yaklasan mac ozeti. */
export interface UpcomingFixture {
  id: string;
  utcDate: string;
  homeName: string;
  awayName: string;
  matchday: number | null;
}

/**
 * Ligin onumuzdeki (oynanmamis) maclari. Fikstur sekmesiyle ORTAK kalici onbellegi
 * kullanir: ayni lig icin ikinci bir API istegi atilmaz.
 */
export async function fetchUpcomingFixtures(leagueId: number): Promise<UpcomingFixture[]> {
  if (!hasApiCompetition(leagueId)) throw new Error('Bu lig için API eşleşmesi tanımlı değil.');
  const { fixtures } = await getLeagueFixtures(leagueId);
  return fixtures
    .filter((f) => f.status === 'scheduled')
    .map((f) => ({
      id: f.id,
      utcDate: f.utcDate,
      homeName: f.homeName,
      awayName: f.awayName,
      matchday: f.matchday,
    }));
}

const ODDS_TTL_MS = 6 * 60 * 60 * 1000;
/** Oynanmis macin oranlari/IY'si artik degismez: uzun sure saklanir. */
const FINAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Oran henuz yayinlanmamissa (404) daha sik tekrar denenir. */
const ODDS_NULL_TTL_MS = 60 * 60 * 1000;

const oddsKey = (matchId: string) => `odds:${matchId}`;

function oddsFresh(entry: { data: unknown; fetchedAt: number }, final = false): boolean {
  const ttl = entry.data ? (final ? FINAL_TTL_MS : ODDS_TTL_MS) : ODDS_NULL_TTL_MS;
  return Date.now() - entry.fetchedAt < ttl;
}

/** Onbellekteki orani (eski olsa da) dondurur; `fresh` yeniden istek gerekip gerekmedigini soyler. */
export async function peekFixtureOdds(
  matchId: string,
  final = false,
): Promise<{ odds: FixtureOdds | null; fresh: boolean } | null> {
  const cached = await getCache<FixtureOdds | null>(oddsKey(matchId));
  return cached ? { odds: cached.data, fresh: oddsFresh(cached, final) } : null;
}

/**
 * Macin Bet365 acilis ve guncel oranlari. Taze onbellek varsa API'ye GITMEZ
 * (`network: false`). 404 (oran yayinlanmamis) hata degil, `odds: null` doner.
 */
export async function loadFixtureOdds(
  matchId: string,
  final = false,
): Promise<{ odds: FixtureOdds | null; network: boolean }> {
  const cached = await getCache<FixtureOdds | null>(oddsKey(matchId));
  if (cached && oddsFresh(cached, final)) return { odds: cached.data, network: false };

  let data: FixtureOdds | null = null;
  try {
    const res = await apiGet<{ data: TsaMatchOdds }>(`/football/matches/${matchId}/odds`);
    data = extractBet365Odds(res.data);
  } catch (e) {
    if (!(axios.isAxiosError(e) && e.response?.status === 404)) throw e;
  }
  await setCache(oddsKey(matchId), data);
  return { odds: data, network: true };
}

export async function fetchFixtureOdds(matchId: string): Promise<FixtureOdds | null> {
  return (await loadFixtureOdds(matchId)).odds;
}

// ---------------------------------------------------------------------------
// Oynanmis macin IY skoru (mac detayi) — kalici onbellekli
// ---------------------------------------------------------------------------

export interface HalfTime {
  home: number | null;
  away: number | null;
}
const htKey = (matchId: string) => `ht:${matchId}`;

export async function peekHalfTime(
  matchId: string,
): Promise<{ ht: HalfTime | null; fresh: boolean } | null> {
  const cached = await getCache<HalfTime | null>(htKey(matchId));
  return cached ? { ht: cached.data, fresh: oddsFresh(cached, true) } : null;
}

/** Macin devre arasi skoru. IY yoksa/404 ise `ht: null`. Taze onbellek varsa API'ye gitmez. */
export async function loadHalfTime(
  matchId: string,
): Promise<{ ht: HalfTime | null; network: boolean }> {
  const cached = await getCache<HalfTime | null>(htKey(matchId));
  if (cached && oddsFresh(cached, true)) return { ht: cached.data, network: false };

  let ht: HalfTime | null = null;
  try {
    const res = await apiGet<{ data: TsaMatchDetail }>(`/football/matches/${matchId}`);
    const h = res.data.score.half_time_home;
    const a = res.data.score.half_time_away;
    if (h != null && a != null) ht = { home: h, away: a };
  } catch (e) {
    if (!(axios.isAxiosError(e) && e.response?.status === 404)) throw e;
  }
  await setCache(htKey(matchId), ht);
  return { ht, network: true };
}
