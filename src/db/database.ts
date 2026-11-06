import * as SQLite from 'expo-sqlite';

/**
 * assets/betting.db her yeniden uretildiginde (yeni IY / hafta verisi) bu surum
 * artirilir. DB dosyasinin ADI surumu icerir: eski kurulumlarda kalan WAL
 * artiklari yeni dosyaya karismaz ("database disk image is malformed" olmaz) ve
 * yeni ad hic var olmadigi icin asset kendiliginden kopyalanir.
 */
export const DB_VERSION = 4;
export const DB_NAME = `betting-v${DB_VERSION}.db`;
/** Surum adlandirmasindan onceki eski dosya (temizlik icin). */
export const LEGACY_DB_NAMES = ['betting.db', 'betting-v3.db'];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
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

    -- API yanitlari icin kalici onbellek (istek limitini korumak icin).
    CREATE TABLE IF NOT EXISTS api_cache (
      key TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      fetched_at INTEGER NOT NULL
    );

    -- Lig x hafta basina IY/MS "ters donus" (1/2 ve 2/1) sayilari.
    -- matches tablosundan turetilir, bkz. weekStatsRepo.refreshWeekStats.
    CREATE TABLE IF NOT EXISTS week_stats (
      league_id INTEGER NOT NULL,
      season INTEGER NOT NULL,
      matchday INTEGER NOT NULL,
      matches_total INTEGER NOT NULL,
      matches_with_ht INTEGER NOT NULL,
      count_12 INTEGER NOT NULL,
      count_21 INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (league_id, season, matchday)
    );
  `);

  // Dosya kaynakli (fd_*) maclarin API karsiligi (mt_*): kuyruk API'yi bununla cagirir,
  // sonucu match_id'ye yazar. Eski DB'lerde kolon yoktur; varsa hata verir, yok sayilir.
  try {
    await db.execAsync(`ALTER TABLE sync_queue ADD COLUMN api_id TEXT`);
  } catch {
    // kolon zaten var
  }
}

/** Uygulama boyunca tek bir SQLite baglantisi (lazy-init + migration). */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await migrate(db);
      return db;
    });
  }
  return dbPromise;
}
