#!/usr/bin/env node
/**
 * Uygulamanin DISINDA calisan toplu veri cekme script'i.
 *
 * Amac: TheStatsAPI'den IY skoru + Bet365 orani gibi "mac basina 1 istek"
 * gerektiren verileri, uygulamayi hic acmadan, bu bilgisayarda (gun/hafta
 * boyunca, istedigin kadar durup devam ederek) cekip src/db/database.ts ile
 * AYNI semaya sahip bir SQLite dosyasina yazmak.
 *
 * Bittiginde (ya da "yeterince" bittiginde) olusan .db dosyasi
 * `assets/betting.db` olarak projeye konup expo-sqlite'in bundled-asset
 * ozelligiyle (importDatabaseFromAssetAsync) uygulamaya gomulebilir — o zaman
 * kullanici ilk acilista hazir veriyi gorur, telefonda hic beklemez.
 *
 * Kullanim:
 *   node scripts/seedDatabase.js
 *
 * Kota/rate limit asimina güvenli: 429 alinca Retry-After'a gore bekler,
 * aylik kota tukenmeye yaklasinca DURUR (crash etmez) ve ne zaman devam
 * edebilecegini yazar. Yeniden calistirildiginda zaten DB'de olan
 * mac/IY/oran verisini tekrar cekmez (upsert + "hangi mac eksik" kontrolu).
 */

const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const axios = require('axios');

const LEAGUE_META = require('../src/data/leagueMeta.json');

// ---------------------------------------------------------------------------
// Ayarlar
// ---------------------------------------------------------------------------

const BU_YIL = new Date().getFullYear();
// "Bu sezon + gecen 2 sezon". Sezon yili = sezonun basladigi yil
// (TheStatsAPI start_year). Gerekirse elle degistir.
const SEASON_YEARS = [BU_YIL, BU_YIL - 1, BU_YIL - 2];

const API_BASE = 'https://api.thestatsapi.com/api';
const API_KEY = process.env.THESTATSAPI_KEY || process.env.EXPO_PUBLIC_THESTATSAPI_KEY;

const DB_PATH = path.join(__dirname, '..', 'betting-seed.db');

const MIN_CALL_GAP_MS = 5200; // ~11.5 istek/dk — 12/dk siniri altinda guvenli pay
const QUOTA_SAFETY_MARGIN = 15; // aylik kota bu kadar kalinca dur
const MAX_LIST_PAGES = 10; // bir lig-sezon icin mac listesinde en fazla gezilecek sayfa

if (!API_KEY) {
  console.error('HATA: THESTATSAPI_KEY (veya EXPO_PUBLIC_THESTATSAPI_KEY) ortam degiskeni bulunamadi.');
  console.error('Calistirmadan once: export THESTATSAPI_KEY=... (veya .env dosyasini yukle)');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// DB — src/db/database.ts ile BIREBIR AYNI sema
// ---------------------------------------------------------------------------

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    competition_id TEXT NOT NULL,
    season_id TEXT NOT NULL,
    league_id INTEGER NOT NULL,
    season INTEGER NOT NULL,
    matchday INTEGER,
    utc_date TEXT NOT NULL,
    status TEXT NOT NULL,
    home_team_id TEXT NOT NULL,
    home_team_name TEXT NOT NULL,
    away_team_id TEXT NOT NULL,
    away_team_name TEXT NOT NULL,
    ft_home INTEGER,
    ft_away INTEGER,
    winner TEXT,
    ht_home INTEGER,
    ht_away INTEGER,
    ht_fetched_at INTEGER,
    odds_json TEXT,
    odds_fetched_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_matches_comp_season ON matches(competition_id, season_id);
  CREATE INDEX IF NOT EXISTS idx_matches_league_season ON matches(league_id, season);

  CREATE TABLE IF NOT EXISTS sync_queue (
    match_id TEXT PRIMARY KEY,
    needs_ht INTEGER NOT NULL DEFAULT 0,
    needs_odds INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    enqueued_at INTEGER NOT NULL
  );
`);

const stmtUpsertMatch = db.prepare(`
  INSERT INTO matches (
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
    matchday = excluded.matchday
`);

const stmtEnqueue = db.prepare(`
  INSERT INTO sync_queue (match_id, needs_ht, needs_odds, attempts, enqueued_at)
  VALUES (?, 1, 1, 0, ?)
  ON CONFLICT(match_id) DO NOTHING
`);

const stmtKnownIds = db.prepare(
  `SELECT id FROM matches WHERE competition_id = ? AND season_id = ?`,
);

const stmtMissingSync = db.prepare(`
  SELECT id FROM matches
  WHERE competition_id = ? AND season_id = ?
    AND (ht_fetched_at IS NULL OR odds_fetched_at IS NULL)
`);

const stmtUpdateHt = db.prepare(
  `UPDATE matches SET ht_home = ?, ht_away = ?, ht_fetched_at = ? WHERE id = ?`,
);
const stmtUpdateOdds = db.prepare(
  `UPDATE matches SET odds_json = ?, odds_fetched_at = ? WHERE id = ?`,
);
const stmtNextQueueItem = db.prepare(
  `SELECT * FROM sync_queue ORDER BY enqueued_at ASC LIMIT 1`,
);
const stmtDeleteQueueItem = db.prepare(`DELETE FROM sync_queue WHERE match_id = ?`);
const stmtUpdateQueueItem = db.prepare(
  `UPDATE sync_queue SET needs_ht = ?, needs_odds = ?, attempts = ? WHERE match_id = ?`,
);
const stmtQueueCount = db.prepare(`SELECT COUNT(*) as c FROM sync_queue`);

// ---------------------------------------------------------------------------
// API istemcisi — rate limit + aylik kota farkindaligi
// ---------------------------------------------------------------------------

const client = axios.create({
  baseURL: API_BASE,
  headers: { Authorization: `Bearer ${API_KEY}` },
});

let lastCallAt = 0;
let sonBilinenKota = null;

async function throttle() {
  const wait = MIN_CALL_GAP_MS - (Date.now() - lastCallAt);
  if (wait > 0) await sleep(wait);
  lastCallAt = Date.now();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class KotaTukendiError extends Error {}

async function apiGet(path, params) {
  for (let attempt = 0; attempt < 6; attempt++) {
    await throttle();
    try {
      const res = await client.get(path, { params });
      kontrolEtKota(res.headers);
      return res.data;
    } catch (err) {
      if (err instanceof KotaTukendiError) throw err;
      const status = err.response?.status;
      if (status === 429) {
        const retryAfter = parseInt(err.response.headers['retry-after'] || '5', 10);
        console.warn(`  [429] rate limit — ${retryAfter}s bekleniyor…`);
        await sleep((retryAfter + 1) * 1000);
        continue;
      }
      console.warn(`  [HATA] ${path} -> ${status || err.message}`);
      return null;
    }
  }
  console.warn(`  [HATA] ${path} -> cok fazla 429, atlaniyor.`);
  return null;
}

function kontrolEtKota(headers) {
  const kalan = headers['x-monthly-quota-remaining'];
  const reset = headers['x-monthly-quota-reset'];
  if (kalan != null) {
    sonBilinenKota = { remaining: parseInt(kalan, 10), resetAt: reset ? parseInt(reset, 10) : null };
    if (sonBilinenKota.remaining <= QUOTA_SAFETY_MARGIN) {
      throw new KotaTukendiError();
    }
  }
}

function kotaMesajiYazVeCik() {
  console.log('\n=== AYLIK KOTA TUKENIYOR ===');
  if (sonBilinenKota?.resetAt) {
    const tarih = new Date(sonBilinenKota.resetAt * 1000);
    console.log(`Kalan istek: ${sonBilinenKota.remaining}. Kota yenilenme: ${tarih.toLocaleString('tr-TR')}`);
  } else {
    console.log('Kalan istek cok az. Bir sure sonra tekrar calistir.');
  }
  console.log('Script guvenle durduruldu — ilerleme SQLite dosyasina zaten yazildi.');
  console.log('Script tekrar calistirildiginda kaldigi yerden surer.\n');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Bet365 oran cikarici (src/db/oddsMapper.ts ile ayni mantik)
// ---------------------------------------------------------------------------

function parseOran(v) {
  if (v == null) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function toOddsValue(side) {
  return { opening: parseOran(side?.opening), closing: parseOran(side?.last_seen) };
}

function extractBet365Odds(odds) {
  if (!odds) return null;
  const bet365 = odds.bookmakers?.find((b) => b.bookmaker?.toLowerCase() === 'bet365');
  if (!bet365?.markets?.match_odds) return null;
  const mo = bet365.markets.match_odds;
  const t25 = bet365.markets.total_goals?.['2.5'];
  return {
    home: toOddsValue(mo.home),
    draw: toOddsValue(mo.draw),
    away: toOddsValue(mo.away),
    over25: toOddsValue(t25?.over),
    under25: toOddsValue(t25?.under),
  };
}

// ---------------------------------------------------------------------------
// Sezon cozumleme (start_year bazli — bkz. src/services/api.ts'teki not)
// ---------------------------------------------------------------------------

const seasonCache = new Map();

async function resolveSeasonId(competitionId, year) {
  let seasons = seasonCache.get(competitionId);
  if (!seasons) {
    const data = await apiGet(`/football/competitions/${competitionId}/seasons`);
    seasons = data?.data ?? [];
    seasonCache.set(competitionId, seasons);
  }
  return seasons.find((s) => s.start_year === year)?.id ?? null;
}

// ---------------------------------------------------------------------------
// 1) Mac listesini kesfet + upsert + eksik olanlari kuyruga ekle
// ---------------------------------------------------------------------------

async function discoverMatches(meta, leagueId, season, seasonId) {
  const known = new Set(stmtKnownIds.all(meta.competitionId, seasonId).map((r) => r.id));
  let yeniSayisi = 0;

  outer: for (let page = 1; page <= MAX_LIST_PAGES; page++) {
    const data = await apiGet('/football/matches', {
      competition_id: meta.competitionId,
      season_id: seasonId,
      status: 'finished',
      page,
      per_page: 100,
      sort: '-utc_date',
    });
    const batch = data?.data ?? [];
    if (batch.length === 0) break;

    for (const m of batch) {
      if (known.has(m.id)) break outer;
      stmtUpsertMatch.run(
        m.id, m.competition_id, m.season_id, leagueId, season, m.matchday,
        m.utc_date, m.status, m.home_team.id, m.home_team.name, m.away_team.id,
        m.away_team.name, m.score.home, m.score.away, m.score.winner,
      );
      yeniSayisi++;
    }

    if (batch.length < 100) break;
  }

  // Eksik IY/oran'i olan HER maci (yeni veya onceki kesintili rundan kalan) kuyruga ekle.
  const eksikler = stmtMissingSync.all(meta.competitionId, seasonId);
  const now = Date.now();
  for (const row of eksikler) {
    stmtEnqueue.run(row.id, now);
  }

  return { yeniSayisi, kuyrugaEklenen: eksikler.length };
}

// ---------------------------------------------------------------------------
// 2) Kuyrugu bosalt (IY detayi + Bet365 orani)
// ---------------------------------------------------------------------------

async function drainQueue() {
  const toplam = stmtQueueCount.get().c;
  if (toplam === 0) {
    console.log('Kuyruk bos — IY/oran acisindan her sey guncel.');
    return;
  }

  console.log(`\nKuyrukta ${toplam} mac var. IY + Bet365 orani cekiliyor…`);
  let islenen = 0;
  const baslangic = Date.now();

  while (true) {
    const item = stmtNextQueueItem.get();
    if (!item) break;

    let htDone = item.needs_ht === 0;
    let oddsDone = item.needs_odds === 0;

    if (item.needs_ht === 1) {
      const detail = await apiGet(`/football/matches/${item.match_id}`);
      const m = detail?.data;
      if (m) {
        stmtUpdateHt.run(m.score.half_time_home ?? null, m.score.half_time_away ?? null, Date.now(), item.match_id);
        htDone = true;
      }
    }

    if (item.needs_odds === 1) {
      const oddsRes = await apiGet(`/football/matches/${item.match_id}/odds`);
      const bet365 = extractBet365Odds(oddsRes?.data);
      stmtUpdateOdds.run(bet365 ? JSON.stringify(bet365) : null, Date.now(), item.match_id);
      oddsDone = true;
    }

    const attempts = item.attempts + 1;
    if ((htDone && oddsDone) || attempts >= 5) {
      stmtDeleteQueueItem.run(item.match_id);
    } else {
      stmtUpdateQueueItem.run(htDone ? 0 : 1, oddsDone ? 0 : 1, attempts, item.match_id);
    }

    islenen++;
    const kalan = stmtQueueCount.get().c;
    if (islenen % 10 === 0 || kalan === 0) {
      const gecenDk = (Date.now() - baslangic) / 60000;
      const hiz = islenen / Math.max(gecenDk, 0.01); // mac/dk
      const etaDk = hiz > 0 ? Math.ceil(kalan / hiz) : '?';
      const kotaStr = sonBilinenKota ? `, kalan kota: ${sonBilinenKota.remaining}` : '';
      console.log(`  ${islenen}/${toplam} islendi — kalan: ${kalan}, tahmini sure: ~${etaDk} dk${kotaStr}`);
    }
  }

  console.log('Kuyruk tamamlandi.');
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`DB dosyasi: ${DB_PATH}`);
  console.log(`Sezon yillari: ${SEASON_YEARS.join(', ')}`);
  console.log(`Ligler: ${Object.keys(LEAGUE_META).length}\n`);

  try {
    for (const [leagueIdStr, meta] of Object.entries(LEAGUE_META)) {
      const leagueId = Number(leagueIdStr);

      for (const year of SEASON_YEARS) {
        console.log(`\n--- ${meta.name} (${meta.country}) — sezon ${year} ---`);
        const seasonId = await resolveSeasonId(meta.competitionId, year);
        if (!seasonId) {
          console.log(`  sezon ${year} bulunamadi, atlaniyor.`);
          continue;
        }

        const { yeniSayisi, kuyrugaEklenen } = await discoverMatches(meta, leagueId, year, seasonId);
        console.log(`  ${yeniSayisi} yeni mac, ${kuyrugaEklenen} mac kuyrukta (IY/oran bekliyor).`);
      }
    }

    await drainQueue();
    console.log('\nTamamlandi. DB dosyasi hazir:', DB_PATH);
  } catch (err) {
    if (err instanceof KotaTukendiError) {
      kotaMesajiYazVeCik();
      return;
    }
    throw err;
  }
}

main().catch((err) => {
  console.error('Beklenmeyen hata:', err);
  process.exit(1);
});
