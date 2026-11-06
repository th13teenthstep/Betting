#!/usr/bin/env node
/**
 * ~/Desktop/MatchResults altindaki football-data.co.uk tarzi xlsx/csv
 * dosyalarini okuyup src/db/database.ts ile AYNI semaya sahip SQLite
 * dosyasina (betting-seed.db) yazar. Tamamen yerel — ag istegi yok,
 * rate limit/kota yok.
 *
 * Her mac icin IY skoru + Bet365 orani (acilis/kapanis) dosyadan DOGRUDAN
 * geliyor, bu yuzden sync_queue'ya hic girmiyor — kayit aninda tamamlanmis
 * sayilir.
 *
 * Kullanim:
 *   node scripts/importFootballData.js [/path/to/MatchResults]
 *
 * Tekrar calistirmak guvenli (upsert, deterministik mac id'si).
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const XLSX = require('xlsx');

const LEAGUE_META = require('../src/data/leagueMeta.json');

const DATA_DIR = process.argv[2] || path.join(process.env.HOME, 'Desktop', 'MatchResults');
const DB_PATH = path.join(__dirname, '..', 'betting-seed.db');

// ---------------------------------------------------------------------------
// DB — src/db/database.ts ile BIREBIR AYNI sema (+ source kolonu)
// ---------------------------------------------------------------------------

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    competition_id TEXT,
    season_id TEXT,
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
    odds_fetched_at INTEGER,
    source TEXT NOT NULL DEFAULT 'api'
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

// Eski DB dosyalarinda "source" kolonu olmayabilir — varsa ekle.
try {
  db.exec(`ALTER TABLE matches ADD COLUMN source TEXT NOT NULL DEFAULT 'api'`);
} catch (_e) {
  // kolon zaten var
}

const stmtUpsert = db.prepare(`
  INSERT INTO matches (
    id, competition_id, season_id, league_id, season, matchday,
    utc_date, status, home_team_id, home_team_name, away_team_id,
    away_team_name, ft_home, ft_away, winner, ht_home, ht_away,
    ht_fetched_at, odds_json, odds_fetched_at, source
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'file')
  ON CONFLICT(id) DO UPDATE SET
    ft_home = excluded.ft_home,
    ft_away = excluded.ft_away,
    winner = excluded.winner,
    ht_home = excluded.ht_home,
    ht_away = excluded.ht_away,
    ht_fetched_at = excluded.ht_fetched_at,
    odds_json = excluded.odds_json,
    odds_fetched_at = excluded.odds_fetched_at
`);

// ---------------------------------------------------------------------------
// Yardimcilar
// ---------------------------------------------------------------------------

function normalizeTeamName(name) {
  return String(name).trim().toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

function teamId(name) {
  return `fdteam_${hashStr(normalizeTeamName(name))}`;
}

function matchId(leagueId, season, isoDate, home, away) {
  const key = `${leagueId}|${season}|${isoDate}|${normalizeTeamName(home)}|${normalizeTeamName(away)}`;
  return `fd_${hashStr(key)}`;
}

/** Excel seri tarih + kesirli saat -> ISO 8601 (UTC). */
function excelSerialToIso(serial, timeFraction) {
  const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
  const days = Number(serial) || 0;
  const frac = Number(timeFraction) || 0;
  const ms = EXCEL_EPOCH_MS + (days + frac) * 86400000;
  return new Date(ms).toISOString();
}

/** "dd/mm/yy" veya "dd/mm/yyyy" + "HH:MM" -> ISO 8601 (UTC). */
function textDateToIso(dateStr, timeStr) {
  const [d, m, yRaw] = String(dateStr).split('/').map((x) => x.trim());
  let year = parseInt(yRaw, 10);
  if (yRaw.length === 2) year += year < 70 ? 2000 : 1900;
  let hour = 0, minute = 0;
  if (timeStr) {
    const [h, mi] = String(timeStr).split(':');
    hour = parseInt(h, 10) || 0;
    minute = parseInt(mi, 10) || 0;
  }
  return new Date(Date.UTC(year, parseInt(m, 10) - 1, parseInt(d, 10), hour, minute)).toISOString();
}

/** "2012/2013", "2024", "2026/2027" -> baslangic yili (sayi). */
function seasonStartYear(seasonStr) {
  const match = String(seasonStr).match(/\d{4}/);
  return match ? parseInt(match[0], 10) : null;
}

function winnerFromRes(res) {
  if (res === 'H') return 'home';
  if (res === 'A') return 'away';
  if (res === 'D') return 'draw';
  return null;
}

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** FixtureOddsValue uretir: {opening, closing}. */
function oddsValue(opening, closing) {
  const o = num(opening);
  const c = num(closing);
  if (o === null && c === null) return { opening: null, closing: null };
  return { opening: o, closing: c };
}

// ---------------------------------------------------------------------------
// Zengin sema (xlsx sheet'leri) -> satir isleme
// ---------------------------------------------------------------------------

function processRichRow(row, leagueId, season) {
  if (!row.HomeTeam || !row.AwayTeam) return null;

  const isoDate = typeof row.Date === 'number'
    ? excelSerialToIso(row.Date, row.Time)
    : textDateToIso(row.Date, row.Time);

  const ftHome = num(row.FTHG);
  const ftAway = num(row.FTAG);
  const htHome = num(row.HTHG);
  const htAway = num(row.HTAG);

  const odds = {
    home: oddsValue(row.B365H, row.B365CH),
    draw: oddsValue(row.B365D, row.B365CD),
    away: oddsValue(row.B365A, row.B365CA),
    over25: oddsValue(row['B365>2.5'], row['B365C>2.5']),
    under25: oddsValue(row['B365<2.5'], row['B365C<2.5']),
  };
  const hasOdds = Object.values(odds).some((v) => v.opening !== null || v.closing !== null);

  const id = matchId(leagueId, season, isoDate, row.HomeTeam, row.AwayTeam);
  const now = Date.now();

  return [
    id, null, null, leagueId, season, null,
    isoDate, 'finished', teamId(row.HomeTeam), String(row.HomeTeam).trim(),
    teamId(row.AwayTeam), String(row.AwayTeam).trim(),
    ftHome, ftAway, winnerFromRes(row.FTR),
    htHome, htAway, htHome !== null ? now : null,
    hasOdds ? JSON.stringify(odds) : null, hasOdds ? now : null,
  ];
}

// ---------------------------------------------------------------------------
// Sade sema (cok sezonlu CSV) -> satir isleme
// ---------------------------------------------------------------------------

function processSimpleRow(row, leagueId) {
  if (!row.Home || !row.Away) return null;

  const season = seasonStartYear(row.Season);
  if (season === null) return null;

  const isoDate = textDateToIso(row.Date, row.Time);
  const ftHome = num(row.HG);
  const ftAway = num(row.AG);

  const odds = {
    home: oddsValue(null, row.B365CH),
    draw: oddsValue(null, row.B365CD),
    away: oddsValue(null, row.B365CA),
    over25: oddsValue(null, null),
    under25: oddsValue(null, null),
  };
  const hasOdds = odds.home.closing !== null || odds.draw.closing !== null || odds.away.closing !== null;

  const id = matchId(leagueId, season, isoDate, row.Home, row.Away);
  const now = Date.now();

  return {
    season,
    row: [
      id, null, null, leagueId, season, null,
      isoDate, 'finished', teamId(row.Home), String(row.Home).trim(),
      teamId(row.Away), String(row.Away).trim(),
      ftHome, ftAway, winnerFromRes(row.Res),
      null, null, null, // bu liglerde IY verisi yok
      hasOdds ? JSON.stringify(odds) : null, hasOdds ? now : null,
    ],
  };
}

// ---------------------------------------------------------------------------
// xlsx dosyalarini isle
// ---------------------------------------------------------------------------

function processXlsxFiles() {
  const xlsxFiles = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.xlsx'));
  console.log(`\n${xlsxFiles.length} xlsx dosyasi bulundu.`);

  const sheetToLeague = new Map();
  for (const [leagueId, meta] of Object.entries(LEAGUE_META)) {
    if (meta.xlsxSheet) sheetToLeague.set(meta.xlsxSheet, Number(leagueId));
  }

  for (const file of xlsxFiles) {
    const seasonMatch = file.match(/(\d{4})-\d{4}/);
    const season = seasonMatch ? parseInt(seasonMatch[1], 10) : null;
    if (season === null) {
      console.log(`  ! ${file}: sezon yili cikarilamadi, atlandi.`);
      continue;
    }

    console.log(`\n--- ${file} (sezon ${season}) ---`);
    const wb = XLSX.readFile(path.join(DATA_DIR, file), { cellDates: false });

    for (const [sheetName, leagueId] of sheetToLeague) {
      const sheet = wb.Sheets[sheetName];
      if (!sheet) continue;
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

      let yazilan = 0;
      db.exec('BEGIN');
      for (const row of rows) {
        const values = processRichRow(row, leagueId, season);
        if (values) {
          stmtUpsert.run(...values);
          yazilan++;
        }
      }
      db.exec('COMMIT');

      const meta = LEAGUE_META[String(leagueId)];
      console.log(`  ${sheetName} (${meta.name}): ${yazilan}/${rows.length} mac yazildi.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Cok sezonlu CSV dosyalarini isle
// ---------------------------------------------------------------------------

function processMultiSeasonCsvFiles() {
  const byFile = new Map();
  for (const [leagueId, meta] of Object.entries(LEAGUE_META)) {
    if (meta.csvFile) {
      if (!byFile.has(meta.csvFile)) byFile.set(meta.csvFile, []);
      byFile.get(meta.csvFile).push({ leagueId: Number(leagueId), filter: meta.csvLeagueFilter, name: meta.name });
    }
  }

  console.log(`\n${byFile.size} cok-sezonlu CSV dosyasi islenecek.`);

  for (const [file, leagues] of byFile) {
    const fullPath = path.join(DATA_DIR, file);
    if (!fs.existsSync(fullPath)) {
      console.log(`  ! ${file} bulunamadi, atlandi.`);
      continue;
    }

    console.log(`\n--- ${file} ---`);
    const wb = XLSX.read(fs.readFileSync(fullPath), { type: 'buffer', raw: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

    for (const { leagueId, filter, name } of leagues) {
      const normFilter = filter.trim().toLowerCase();
      let yazilan = 0;
      const seasons = new Set();

      db.exec('BEGIN');
      for (const row of rows) {
        const league = String(row.League || '').trim().toLowerCase();
        if (league !== normFilter) continue;

        const result = processSimpleRow(row, leagueId);
        if (result) {
          stmtUpsert.run(...result.row);
          seasons.add(result.season);
          yazilan++;
        }
      }
      db.exec('COMMIT');

      console.log(
        `  ${name} (leagueId ${leagueId}): ${yazilan} mac yazildi. Sezonlar: ${[...seasons].sort().join(', ')}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

console.log(`Veri klasoru: ${DATA_DIR}`);
console.log(`DB dosyasi: ${DB_PATH}`);

processXlsxFiles();
processMultiSeasonCsvFiles();

const toplam = db.prepare('SELECT COUNT(*) c FROM matches').get().c;
console.log(`\nTamamlandi. DB'de toplam ${toplam} mac var.`);
