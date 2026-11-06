import { getCache, setCache } from '../db/apiCacheRepo';
import { recordApiDuration } from './apiTiming';
import { apiGet, describeApiError } from './thestatsapi';
import competitions from '../data/apiCompetitions.json';
import type { TsaMatch, TsaPaginated } from '../types/thestatsapi';

const COMPETITIONS = competitions as Record<string, string>;

/** Onbellek omru: fikstur nadiren degisir; limiti korumak icin 6 saat. */
const TTL_MS = 6 * 60 * 60 * 1000;
/** Icinde bulunulan haftanin oynanmis maclari da gelsin diye geriye bakis. */
const LOOKBACK_DAYS = 4;

export type FixtureStatus = 'scheduled' | 'live' | 'finished';

export interface LeagueFixture {
  id: string;
  utcDate: string;
  status: FixtureStatus;
  matchday: number | null;
  homeName: string;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
}

export interface FixtureResult {
  fixtures: LeagueFixture[];
  fetchedAt: number;
  /** Veri onbellekten mi geldi (ag istegi atilmadi)? */
  fromCache: boolean;
  /** Onbellek eski ama yenilenemedi (ag/limit hatasi) — nedeni `error`de. */
  stale: boolean;
  error?: string;
}

const inFlight = new Map<number, Promise<FixtureResult>>();

function pad(n: number) {
  return String(n).padStart(2, '0');
}
function dateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toFixture(m: TsaMatch): LeagueFixture | null {
  if (m.status !== 'scheduled' && m.status !== 'live' && m.status !== 'finished') return null;
  return {
    id: m.id,
    utcDate: m.utc_date,
    status: m.status,
    matchday: m.matchday,
    homeName: m.home_team.name,
    awayName: m.away_team.name,
    homeScore: m.score.home,
    awayScore: m.score.away,
  };
}

async function fetchFromApi(leagueId: number): Promise<LeagueFixture[]> {
  const competitionId = COMPETITIONS[String(leagueId)];
  if (!competitionId) throw new Error('Bu lig için API eşleşmesi tanımlı değil.');

  const from = new Date();
  from.setDate(from.getDate() - LOOKBACK_DAYS);

  const started = Date.now();
  const res = await apiGet<TsaPaginated<TsaMatch>>('/football/matches', {
    competition_id: competitionId,
    date_from: dateString(from),
    sort: 'utc_date',
    per_page: 100,
  });
  recordApiDuration(Date.now() - started);

  return res.data.map(toFixture).filter((f): f is LeagueFixture => f !== null);
}

/**
 * Ligin yaklasan (ve son gunlerdeki) maclari. Once kalici onbellege bakar; taze ise
 * HIC istek atmaz. `force` ile zorla yenilenir. Yenileme basarisiz olursa eski veri
 * `stale: true` ile doner. Ayni lig icin es zamanli cagrilar tek istege indirgenir.
 */
export function getLeagueFixtures(
  leagueId: number,
  opts: { force?: boolean } = {},
): Promise<FixtureResult> {
  const running = inFlight.get(leagueId);
  if (running) return running;

  const task = (async (): Promise<FixtureResult> => {
    const key = `fixtures:${leagueId}`;
    const cached = await getCache<LeagueFixture[]>(key);

    if (!opts.force && cached && Date.now() - cached.fetchedAt < TTL_MS) {
      return { fixtures: cached.data, fetchedAt: cached.fetchedAt, fromCache: true, stale: false };
    }

    try {
      const fixtures = await fetchFromApi(leagueId);
      await setCache(key, fixtures);
      return { fixtures, fetchedAt: Date.now(), fromCache: false, stale: false };
    } catch (e) {
      if (cached) {
        return {
          fixtures: cached.data,
          fetchedAt: cached.fetchedAt,
          fromCache: true,
          stale: true,
          error: describeApiError(e),
        };
      }
      throw e;
    }
  })().finally(() => inFlight.delete(leagueId));

  inFlight.set(leagueId, task);
  return task;
}

export interface FixtureRound {
  title: string;
  /** Hafta numarasi biliniyorsa. */
  matchday: number | null;
  fixtures: LeagueFixture[];
}

const DAY = 24 * 3600 * 1000;
/** Bir hafta, en kalabalik haftanin bu orani ve ustundeyse "normal hafta" sayilir. */
const FULL_ROUND_RATIO = 0.4;

const byDate = (a: LeagueFixture, b: LeagueFixture) => Date.parse(a.utcDate) - Date.parse(b.utcDate);

/**
 * Icinde bulunulan hafta + bir sonraki hafta.
 *
 * Hafta numarasi varsa: haftalar mac sayisina gore ayrilir. Ertelenmis tek tuk maclar
 * ("3. hafta, 1 mac") normal hafta SAYILMAZ; "bu hafta" = baslamis en son normal hafta.
 * Ertelenmis maclar tarihine yakin haftaya eklenir, cok uzaktakiler gizlenir.
 * Hafta numarasi yoksa (orn. MLS) 7'ser gunluk pencerelerle gruplanir.
 */
export function pickCurrentAndNextRound(
  all: LeagueFixture[],
  now: number = Date.now(),
): FixtureRound[] {
  const sorted = [...all].sort(byDate);
  const firstOpen = sorted.find((f) => f.status !== 'finished');
  if (!firstOpen) return [];

  const numbered = sorted.filter((f) => f.matchday != null);
  if (numbered.length < sorted.length / 2) return pickByWindows(sorted, firstOpen);

  const groups = new Map<number, LeagueFixture[]>();
  for (const f of numbered) {
    const md = f.matchday as number;
    if (!groups.has(md)) groups.set(md, []);
    groups.get(md)!.push(f);
  }
  const maxSize = Math.max(...[...groups.values()].map((g) => g.length));
  const full = [...groups.entries()]
    .filter(([, g]) => g.length >= maxSize * FULL_ROUND_RATIO)
    .sort((x, y) => x[0] - y[0]);
  if (full.length === 0) return [];

  // Baslamis (ilk maci gecmiste kalmis) en son normal hafta; hic baslamamissa ilki.
  let curIdx = 0;
  full.forEach(([, g], i) => {
    if (Date.parse(g[0].utcDate) <= now + 3600 * 1000) curIdx = i;
  });

  const chosen = [full[curIdx], full[curIdx + 1]].filter(Boolean) as [number, LeagueFixture[]][];
  const rounds: FixtureRound[] = chosen.map(([md, g], i) => ({
    title: `${i === 0 ? 'Bu hafta' : 'Gelecek hafta'} · ${md}. hafta`,
    matchday: md,
    fixtures: [...g],
  }));

  // Ertelenmis / baska numarali maclari tarihe gore en yakin secili haftaya ekle
  // Sadece "normal hafta" sayilmayan artik maclar eklenir (baska bir TAM haftanin maclari degil).
  const fullMds = new Set(full.map(([md]) => md));
  const span = rounds.map((r) => {
    const t = r.fixtures.map((f) => Date.parse(f.utcDate));
    return { min: Math.min(...t) - 3 * DAY, max: Math.max(...t) + 3 * DAY };
  });
  for (const f of sorted) {
    if (f.matchday != null && fullMds.has(f.matchday)) continue;
    const t = Date.parse(f.utcDate);
    let best = -1;
    let bestDist = Infinity;
    span.forEach((sp, i) => {
      if (t < sp.min || t > sp.max) return;
      const dist = Math.min(Math.abs(t - sp.min), Math.abs(t - sp.max));
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    if (best >= 0) rounds[best].fixtures.push(f);
  }
  rounds.forEach((r) => r.fixtures.sort(byDate));
  return rounds;
}

function pickByWindows(sorted: LeagueFixture[], firstOpen: LeagueFixture): FixtureRound[] {
  const start = Date.parse(firstOpen.utcDate);
  const inRange = (f: LeagueFixture, from: number, to: number) => {
    const t = Date.parse(f.utcDate);
    return t >= from && t < to;
  };
  const week1 = sorted.filter((f) => inRange(f, start - 3 * DAY, start + 4 * DAY));
  const week2 = sorted.filter((f) => inRange(f, start + 4 * DAY, start + 11 * DAY));
  const rounds: FixtureRound[] = [{ title: 'Bu hafta', matchday: null, fixtures: week1 }];
  if (week2.length > 0) rounds.push({ title: 'Gelecek hafta', matchday: null, fixtures: week2 });
  return rounds;
}
