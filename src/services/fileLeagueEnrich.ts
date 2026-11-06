import apiCompetitionsJson from '../data/apiCompetitions.json';
import leagueMetaJson from '../data/leagueMeta.json';
import { getSeasonsForLeague } from '../db/analysisRepo';
import {
  enqueueFileMatches,
  getFileMatchesNeedingData,
  getQueuedFileMatchIds,
} from '../db/matchesRepo';
import { ensureDrainRunning } from '../db/syncEngine';
import { matchTeamName } from '../utils/teamMatch';
import { apiGet } from './thestatsapi';
import type { TsaMatch, TsaPaginated, TsaSeason } from '../types/thestatsapi';

const COMPETITIONS = apiCompetitionsJson as Record<string, string>;
const META = leagueMetaJson as unknown as Record<
  string,
  { source?: string; csvFile?: string | null; name: string; country: string }
>;

const MAX_PAGES = 6;
const PER_PAGE = 100;
/** Dosyadaki saat ile API'deki UTC saat arasindaki olasi fark icin tolerans. */
const DATE_TOLERANCE_MS = 36 * 3600 * 1000;

/**
 * Sade sema CSV'den (CHN.csv, USA.csv ...) gelen ligler: dosyada IY skoru ve (cogu sezonda) oran yok.
 * Bu ligler icin eksikler TheStatsAPI'den kuyruk uzerinden tamamlanir.
 */
export function needsFileEnrichment(leagueId: number): boolean {
  const meta = META[String(leagueId)];
  return meta?.source === 'file' && !!meta.csvFile && COMPETITIONS[String(leagueId)] != null;
}

export interface LeagueGap {
  leagueId: number;
  name: string;
  country: string;
  season: number;
  pending: number;
}

/**
 * IY/kapanis orani dosyada eksik olan TUM liglerin guncel sezonunda hala bekleyen mac sayisi.
 * "Eksik ligleri indir" butonu icin: hangi liglerin eksigi var, kac mac bekliyor.
 */
export async function getLeaguesNeedingEnrichment(): Promise<LeagueGap[]> {
  const out: LeagueGap[] = [];
  for (const idStr of Object.keys(META)) {
    const leagueId = Number(idStr);
    if (!needsFileEnrichment(leagueId)) continue;
    const season = (await getSeasonsForLeague(leagueId))[0];
    if (season == null) continue;
    const pending = await getFileMatchesNeedingData(leagueId, season);
    if (pending.length === 0) continue;
    const meta = META[idStr];
    out.push({ leagueId, name: meta.name, country: meta.country, season, pending: pending.length });
  }
  return out;
}

/**
 * Verilen tum ligleri sirayla senkron kuyruguna ekler; hepsi AYNI arka plan dolgusunda
 * (tek bir ortak kuyruk, tek bir ilerleme cubugu) islenir — kac saat surerse sursun,
 * uygulama arka planda calistigi surece devam eder.
 */
export async function enrichAllLeagues(
  gaps: LeagueGap[],
  onProgress?: (done: number, total: number, current: LeagueGap) => void,
): Promise<void> {
  for (let i = 0; i < gaps.length; i++) {
    onProgress?.(i, gaps.length, gaps[i]);
    await enrichLeagueCurrentSeason(gaps[i].leagueId);
  }
}

const inFlight = new Map<number, Promise<void>>();

/**
 * Ligin en yeni (guncel) sezonunda IY'si / kapanis orani eksik maclari API'deki maclarla
 * eslestirip senkron kuyruguna ekler ve arka plan dolgusunu baslatir. Ilerleme `useSyncProgress`
 * ile izlenir. Ayni lig icin eszamanli cagrilar tek isleme birlesir. Hata firlatir (cagiran gosterir).
 */
export function enrichLeagueCurrentSeason(leagueId: number): Promise<void> {
  if (!needsFileEnrichment(leagueId)) return Promise.resolve();
  const running = inFlight.get(leagueId);
  if (running) return running;
  const p = run(leagueId).finally(() => inFlight.delete(leagueId));
  inFlight.set(leagueId, p);
  return p;
}

async function run(leagueId: number): Promise<void> {
  const season = (await getSeasonsForLeague(leagueId))[0];
  if (season == null) return;

  const queued = await getQueuedFileMatchIds();
  const pending = (await getFileMatchesNeedingData(leagueId, season)).filter(
    (m) => !queued.has(m.id),
  );
  if (pending.length === 0) {
    // Yeni is yok; uygulama yeniden acildiysa yarim kalan kuyrugu surdur.
    await ensureDrainRunning();
    return;
  }

  const competitionId = COMPETITIONS[String(leagueId)];
  const seasons = await apiGet<{ data: TsaSeason[] }>(
    `/football/competitions/${competitionId}/seasons`,
  );
  const apiSeason = seasons.data.find((s) => s.start_year === season);
  if (!apiSeason) throw new Error(`API'de ${season} sezonu bulunamadı.`);

  const apiMatches: TsaMatch[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await apiGet<TsaPaginated<TsaMatch>>('/football/matches', {
      competition_id: competitionId,
      season_id: apiSeason.id,
      status: 'finished',
      per_page: PER_PAGE,
      page,
    });
    apiMatches.push(...res.data);
    if (page >= res.meta.total_pages) break;
  }

  // API takim adi -> DB takim adi (her ad icin bir kez hesaplanir)
  const dbNames = [...new Set(pending.flatMap((m) => [m.home_team_name, m.away_team_name]))];
  const nameCache = new Map<string, string | null>();
  const toDbName = (apiName: string): string | null => {
    if (!nameCache.has(apiName)) nameCache.set(apiName, matchTeamName(apiName, dbNames, leagueId));
    return nameCache.get(apiName) ?? null;
  };

  const used = new Set<string>();
  const items: { id: string; apiId: string; needsHt: boolean; needsOdds: boolean }[] = [];
  for (const row of pending) {
    const t = Date.parse(row.utc_date);
    const best = apiMatches
      .filter(
        (m) =>
          !used.has(m.id) &&
          Math.abs(Date.parse(m.utc_date) - t) <= DATE_TOLERANCE_MS &&
          toDbName(m.home_team.name) === row.home_team_name &&
          toDbName(m.away_team.name) === row.away_team_name,
      )
      .sort((a, b) => Math.abs(Date.parse(a.utc_date) - t) - Math.abs(Date.parse(b.utc_date) - t))[0];
    if (!best) continue;
    used.add(best.id);
    items.push({ id: row.id, apiId: best.id, needsHt: row.needsHt, needsOdds: row.needsOdds });
  }

  console.log(
    `[Enrich] Lig ${leagueId}/${season}: ${pending.length} eksik maçtan ${items.length} tanesi API ile eşleşti.`,
  );
  await enqueueFileMatches(items);
  await ensureDrainRunning();
}
