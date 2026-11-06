import type { Fixture, LeagueStandings, Standing } from '../types/football';
import { maclardanPuanDurumuHesapla } from '../utils/standingsCalculator';
import { hashId } from '../utils/hashId';
import { fetchMatches, fetchSeasons, fetchStandings as fetchTsaStandings } from './thestatsapi';
import type { TsaStandingRow } from '../types/thestatsapi';
import {
  enqueueForSync,
  getFileLeagueSyncState,
  getKnownMatchIds,
  getMatchesForLeagueSeason,
  rowToFixture,
  toMatchInsert,
  upsertMatches,
} from '../db/matchesRepo';
import { ensureDrainRunning } from '../db/syncEngine';
import leagueMetaJson from '../data/leagueMeta.json';
import apiCompetitionsJson from '../data/apiCompetitions.json';

const API_COMPETITIONS = apiCompetitionsJson as Record<string, string>;

// ---------------------------------------------------------------------------
// Bu dosya eskiden API-Football (api-sports.io) kullaniyordu.
// Artik veri kaynagi TheStatsAPI (bkz. ../services/thestatsapi.ts).
// Disariya acilan fonksiyon imzalari ve Fixture/Standing tipleri AYNI birakildi,
// boylece ekranlarda/komponentlerde hicbir degisiklik gerekmiyor.
//
// fetchFixtures artik SQLite'tan okuyor (bkz. ../db/matchesRepo.ts). Mac
// listesi (MS skoru) kucuk/ucuz bir "yeni mac var mi" sorgusuyla guncel
// tutuluyor; IY skoru + Bet365 orani ise arka planda, rate limit'e gore
// yavasca kuyruktan islenip DB'ye yaziliyor (bkz. ../db/syncEngine.ts).
// Boylece bitmis bir macin verisi bir kere cekilir, bir daha hic cekilmez.
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const standingsCache = new Map<
  string,
  CacheEntry<{ league: LeagueStandings['league']; standings: Standing[][] }>
>();

/** Her lig/sezon icin son "yeni mac var mi" sorgusunun ne zaman yapildigi. */
const lastSyncedAt = new Map<string, number>();
const SYNC_TTL_MS = 30_000;

function cacheKey(leagueId: number, season: number): string {
  return `${leagueId}-${season}`;
}

// ---------------------------------------------------------------------------
// Numerik leagueId -> TheStatsAPI competition_id
// ---------------------------------------------------------------------------
// Bu id'ler TheStatsAPI'nin /football/competitions listesinden MANUEL olarak
// dogrulandi (isim bazli arama guvenilmez cikti: "La Liga" aratinca API'de
// gercek ismi "LaLiga" oldugu icin 0 sonuc donuyordu). Sabit id kullanmak
// ayni zamanda her lig secimi icin ekstra bir arama istegi harcamayi da
// onluyor (rate limit dakikada 12 istek).
//
// Tek kaynak: ../data/leagueMeta.json — hem uygulama hem de uygulama disinda
// calisan toplu-cekim script'i (scripts/seedDatabase.js) bu dosyayi kullanir,
// boylece iki yerde ayri ayri tutulup birbirinden sapan bir liste olmaz.

interface LeagueMeta {
  /** 'file' = ~/Desktop/MatchResults'tan tek seferlik import edilmis (bkz. scripts/importFootballData.js). 'api' = TheStatsAPI'den canli cekilir. */
  source: 'api' | 'file';
  name: string;
  country: string;
  logo: string;
  flag: string | null;
  /** Sadece source==='api' icin. */
  competitionId?: string;
}

const LEAGUE_META = leagueMetaJson as unknown as Record<string, LeagueMeta>;

function getLeagueMeta(leagueId: number): LeagueMeta | null {
  return LEAGUE_META[String(leagueId)] ?? null;
}

// ---------------------------------------------------------------------------
// season (yil) -> TheStatsAPI season_id
// ---------------------------------------------------------------------------
// Uygulamadaki "season" degeri sezonun BASLANGIC yili (API-Football
// konvansiyonu): 2026 -> 2026/27 sezonu. TheStatsAPI'nin /seasons yaniti
// start_year/end_year alanlarini veriyor (start_date/end_date DEGIL).
//
// Not: "bulunamadi" sonucu kasitli olarak cache'LENMIYOR. Nedeni: competition
// aramasi eskiden rate limit'e (429) carpinca hatayi "bos sonuc" ile
// ayirt edemiyorduk ve "bulunamadi" sonsuza kadar cache'leniyordu. Sezon
// listesi tek ve ucuz bir istek oldugu icin, basarisiz olursa bir dahaki
// cagrida tekrar denenmesi daha guvenli.

const seasonsByCompetitionCache = new Map<string, Awaited<ReturnType<typeof fetchSeasons>>>();

async function resolveSeasonId(
  competitionId: string,
  seasonYear: number,
): Promise<string | null> {
  let seasons = seasonsByCompetitionCache.get(competitionId);
  if (!seasons) {
    seasons = await fetchSeasons(competitionId);
    if (seasons.length > 0) {
      seasonsByCompetitionCache.set(competitionId, seasons);
    }
  }

  const match = seasons.find((s) => s.start_year === seasonYear);
  return match?.id ?? null;
}

function toStanding(row: TsaStandingRow): Standing {
  const stats = {
    played: row.matches_played,
    win: row.wins,
    draw: row.draws,
    lose: row.losses,
    goals: { for: row.goals_for, against: row.goals_against },
  };

  return {
    rank: row.position,
    team: {
      id: hashId(row.team.id),
      name: row.team.name,
      logo: '',
    },
    points: row.points,
    goalsDiff: row.goal_difference,
    group: row.group_label,
    form: null,
    description: null,
    all: stats,
    // TheStatsAPI puan tablosu ev/deplasman ayrimi vermiyor, ayni degeri kullaniyoruz.
    home: { ...stats },
    away: { ...stats },
  };
}

// ---------------------------------------------------------------------------
// SQLite senkronu: sadece yeni (henuz DB'de olmayan) bitmis maclari ceker
// ---------------------------------------------------------------------------
// "-utc_date" (en yeni once) sirasiyla sayfalariz; DB'de zaten bilinen bir
// maca rastladigimiz an dururuz, cunku ondan sonrasi (daha eski maclar) da
// zaten bilinir. Ilk senkronda DB bos oldugu icin tum bitmis maclar cekilir.

async function syncFixturesIntoDb(
  competitionId: string,
  leagueId: number,
  season: number,
  seasonId: string,
): Promise<void> {
  const known = await getKnownMatchIds(competitionId, seasonId);
  const yeniMaclar: ReturnType<typeof toMatchInsert>[] = [];
  const perPage = 100;

  outer: for (let page = 1; page <= 5; page++) {
    const batch = await fetchMatches({
      competitionId,
      seasonId,
      status: 'finished',
      page,
      perPage,
      sort: '-utc_date',
    });
    if (batch.length === 0) break;

    for (const m of batch) {
      if (known.has(m.id)) break outer;
      yeniMaclar.push(toMatchInsert(m, leagueId, season));
    }

    if (batch.length < perPage) break;
  }

  if (yeniMaclar.length === 0) return;

  await upsertMatches(yeniMaclar);
  await enqueueForSync(yeniMaclar.map((m) => m.id));
  console.log(`[DB] ${yeniMaclar.length} yeni mac SQLite'a yazildi ve IY/oran kuyruguna eklendi.`);
  await ensureDrainRunning();
}

// ---------------------------------------------------------------------------
// Dosya kaynakli ligler icin "boslugu kapat" senkronu
// ---------------------------------------------------------------------------
// Tek seferlik dosya importu (football-data CSV) zamanla eskir: sezon devam
// ederken oynanan yeni haftalar DB'ye hic girmez (bkz. kullanicinin bildirdigi
// "bu haftanin bitmis maclari Sonuclar'da yok" hatasi). Burada DB'deki en son
// bilinen mac tarihinden itibaren API'den "finished" maclari cekip ekliyoruz.
// Ayni gune denk gelebilecek CARPISMALARI (dosyadaki mac ile API'den gelenin
// AYNI mac olmasi) tam utc_date eslesmesiyle eliyoruz; date_from gun hassasiyetinde
// oldugu icin son bilinen gunden itibaren tekrar cekilip boylece ayiklaniyor.
function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

async function syncFileLeagueGap(leagueId: number, season: number): Promise<void> {
  const competitionId = API_COMPETITIONS[String(leagueId)];
  if (!competitionId) return;

  const { lastUtcDate, knownUtcDates } = await getFileLeagueSyncState(leagueId, season);
  // Bu lig/sezon icin hic dosya verisi yoksa (ilk import yapilmamis) burasi
  // sadece "bosluk kapatma" icin, dokunmuyoruz.
  if (!lastUtcDate) return;

  const seasonId = await resolveSeasonId(competitionId, season);
  if (!seasonId) return;

  const yeniMaclar: ReturnType<typeof toMatchInsert>[] = [];
  const perPage = 100;
  for (let page = 1; page <= 5; page++) {
    const batch = await fetchMatches({
      competitionId,
      seasonId,
      status: 'finished',
      dateFrom: toDateOnly(lastUtcDate),
      page,
      perPage,
      sort: 'utc_date',
    });
    if (batch.length === 0) break;

    for (const m of batch) {
      if (knownUtcDates.has(m.utc_date)) continue;
      yeniMaclar.push(toMatchInsert(m, leagueId, season));
    }

    if (batch.length < perPage) break;
  }

  if (yeniMaclar.length === 0) return;

  await upsertMatches(yeniMaclar);
  await enqueueForSync(yeniMaclar.map((m) => m.id));
  console.log(
    `[DB] (dosya kaynakli) ${yeniMaclar.length} yeni bitmis mac SQLite'a yazildi ve IY/oran kuyruguna eklendi.`,
  );
  await ensureDrainRunning();
}

// ---------------------------------------------------------------------------
// fetchFixtures
// ---------------------------------------------------------------------------

export async function fetchFixtures(
  leagueId: number,
  season: number,
): Promise<Fixture[]> {
  const key = cacheKey(leagueId, season);

  try {
    const meta = getLeagueMeta(leagueId);
    if (!meta) {
      console.warn(`[API] Lig ${leagueId} icin bir eslesme yok.`);
      return [];
    }

    if (meta.source === 'file') {
      // ~/Desktop/MatchResults'tan tek seferlik import edildi; sezon ilerledikce
      // olusan boslugu (yeni oynanan haftalar) burada API'den tamamliyoruz.
      const sonSenkron = lastSyncedAt.get(key) ?? 0;
      if (Date.now() - sonSenkron > SYNC_TTL_MS) {
        await syncFileLeagueGap(leagueId, season);
        lastSyncedAt.set(key, Date.now());
      }
      const rows = await getMatchesForLeagueSeason(leagueId, season);
      const fixtures = rows.map((row) => rowToFixture(row, meta));
      console.log(`[DB] ${fixtures.length} bitmis mac SQLite'tan okundu (${key}, dosya kaynakli)`);
      return fixtures;
    }

    if (!meta.competitionId) {
      console.warn(`[API] Lig ${leagueId} source='api' ama competitionId tanimli degil.`);
      return [];
    }

    const seasonId = await resolveSeasonId(meta.competitionId, season);
    if (!seasonId) {
      console.warn(`[API] Lig ${leagueId} / sezon ${season} icin TheStatsAPI season bulunamadi.`);
      return [];
    }

    const sonSenkron = lastSyncedAt.get(key) ?? 0;
    if (Date.now() - sonSenkron > SYNC_TTL_MS) {
      console.log(`[API] Lig ${leagueId} / sezon ${season} icin yeni mac kontrolu yapiliyor…`);
      await syncFixturesIntoDb(meta.competitionId, leagueId, season, seasonId);
      lastSyncedAt.set(key, Date.now());
    } else {
      // Onceki senkrondan kalan kuyruk varsa (uygulama yeniden acildiysa) devam ettir.
      void ensureDrainRunning();
    }

    const rows = await getMatchesForLeagueSeason(leagueId, season);
    const fixtures = rows.map((row) => rowToFixture(row, meta));

    console.log(`[DB] ${fixtures.length} bitmis mac SQLite'tan okundu (${key})`);
    return fixtures;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[API] Fikstur hatasi (${message}) – bos donuluyor.`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// fetchStandings
// ---------------------------------------------------------------------------

export async function fetchStandings(
  leagueId: number,
  season: number,
): Promise<{
  league: LeagueStandings['league'] | null;
  standings: Standing[][];
}> {
  const key = cacheKey(leagueId, season);

  const cached = standingsCache.get(key);
  if (cached) {
    const count = cached.data.standings[0]?.length ?? 0;
    console.log(`[API/CACHE] Puan durumu ${key} cache'ten okundu (${count} takim)`);
    return cached.data;
  }

  try {
    const meta = getLeagueMeta(leagueId);

    if (!meta || meta.source === 'file' || !meta.competitionId) {
      // Dosya kaynakli ligler icin TheStatsAPI standings endpoint'i yok —
      // dogrudan maclardan hesapliyoruz (standingsFromFixtures zaten DB'den
      // okuyacak sekilde fetchFixtures'i cagiriyor).
      return await standingsFromFixtures(leagueId, season, key);
    }

    console.log(`[API] Puan durumu cekiliyor: lig=${leagueId} sezon=${season}…`);

    const seasonId = await resolveSeasonId(meta.competitionId, season);
    if (!seasonId) {
      console.warn('[API] Season bulunamadi – fixtures uzerinden hesaplaniyor…');
      return await standingsFromFixtures(leagueId, season, key);
    }

    const rows = await fetchTsaStandings(meta.competitionId, seasonId);

    if (rows.length === 0) {
      console.warn('[API] Standings bos dondu – fixtures uzerinden hesaplaniyor…');
      return await standingsFromFixtures(leagueId, season, key);
    }

    const result = {
      league: {
        id: leagueId,
        name: meta.name,
        country: meta.country,
        logo: meta.logo,
        flag: meta.flag,
        season,
      },
      standings: [rows.map(toStanding)],
    };

    console.log(`[API] Puan durumu geldi (${result.standings[0]?.length ?? 0} takim)`);
    standingsCache.set(key, { data: result, timestamp: Date.now() });
    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[API] Standings hatasi (${message}) – fixtures'tan hesaplaniyor…`);
    return await standingsFromFixtures(leagueId, season, key);
  }
}

/**
 * Fikstur verisinden puan tablosu hesaplar (yedek yontem).
 * O da basarisiz olursa bos dizi doner.
 */
async function standingsFromFixtures(
  leagueId: number,
  season: number,
  key: string,
): Promise<{
  league: LeagueStandings['league'] | null;
  standings: Standing[][];
}> {
  try {
    const fixtures = await fetchFixtures(leagueId, season);

    if (fixtures.length === 0) {
      console.warn('[API] Fikstur de bos – puan durumu hesaplanamadi.');
      return { league: null, standings: [] };
    }

    const hesaplanan = maclardanPuanDurumuHesapla(fixtures);

    if (hesaplanan.length === 0) {
      return { league: null, standings: [] };
    }

    console.log(`[API] Puan durumu ${hesaplanan.length} takim icin fixtures'tan hesaplandi.`);
    const result = {
      league: {
        id: leagueId,
        name: fixtures[0]?.league.name ?? `Lig ${leagueId}`,
        country: fixtures[0]?.league.country ?? '',
        logo: fixtures[0]?.league.logo ?? '',
        flag: fixtures[0]?.league.flag ?? null,
        season,
      },
      standings: [hesaplanan],
    };

    standingsCache.set(key, { data: result, timestamp: Date.now() });
    return result;
  } catch (error: unknown) {
    console.warn('[API] Fikstur ile hesaplama da basarisiz.');
    return { league: null, standings: [] };
  }
}

// ---------------------------------------------------------------------------
// Cache temizleme
// ---------------------------------------------------------------------------

export function clearCache(leagueId: number, season: number): void {
  const key = cacheKey(leagueId, season);
  lastSyncedAt.delete(key);
  standingsCache.delete(key);
  console.log(`[API/CACHE] ${key} icin cache temizlendi`);
}

export function clearAllCache(): void {
  lastSyncedAt.clear();
  standingsCache.clear();
  console.log('[API/CACHE] Tum cache temizlendi');
}
