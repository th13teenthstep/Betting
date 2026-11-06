#!/usr/bin/env node
/**
 * Dosya kaynakli (football-data CSV) ligler icin eksik IY skorlarini
 * TheStatsAPI'den doldurur ve assets/betting.db'ye yazar.
 *
 * Akis:
 *  1) API'de ligi bul, mevcut sezonun bitmis maclarini listele (sayfa basina 100).
 *  2) DB'deki (ht_home IS NULL) maclarla takim adi + tarihe gore eslestir.
 *  3) Eslesen her mac icin detay endpoint'inden half_time_home/away cek
 *     (rate limit: 12 istek/dk). Sonuclar cache dosyasina yazilir, script
 *     durdurulup tekrar calistirilabilir.
 *
 * Kullanim:
 *   node scripts/fillHalfTimeApi.js --league 9020 --comp "MLS" [--season 2026] [--dry-run]
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const axios = require('axios');

// .env'den anahtari oku (dotenv bagimliligi eklemeden)
try {
  const envText = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
} catch {
  /* .env yoksa ortam degiskenine guven */
}

const API_KEY = process.env.THESTATSAPI_KEY || process.env.EXPO_PUBLIC_THESTATSAPI_KEY;
const API = 'https://api.thestatsapi.com/api/football';
const GAP_MS = 5500;
const DB_PATH = path.join(__dirname, '..', 'assets', 'betting.db');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? def : process.argv[i + 1];
}
const LEAGUE_ID = Number(arg('league', '9020'));
const COMP_NAME = arg('comp', 'MLS');
const SEASON = Number(arg('season', String(new Date().getFullYear())));
const DRY = process.argv.includes('--dry-run');
const CACHE = path.join(os.tmpdir(), `ht-cache-${LEAGUE_ID}-${SEASON}.json`);

if (!API_KEY) {
  console.error('THESTATSAPI_KEY bulunamadi (.env).');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastCall = 0;

async function get(url, params) {
  let attempt = 0;
  let netFails = 0;
  while (attempt < 6) {
    attempt++;
    const wait = GAP_MS - (Date.now() - lastCall);
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    try {
      const res = await axios.get(`${API}${url}`, {
        params,
        headers: { Authorization: `Bearer ${API_KEY}` },
        timeout: 30000,
      });
      return res.data;
    } catch (e) {
      const status = e.response?.status;
      if (status === 429) {
        const ra = Number(e.response.headers['retry-after']) || 60;
        console.warn(`429 — ${ra}s bekleniyor`);
        await sleep(ra * 1000);
        continue;
      }
      if (status === 404) return null;
      if (status === 401 || status === 403) {
        console.error(`Yetki/kota hatasi (${status}):`, JSON.stringify(e.response.data));
        process.exit(1);
      }
      if (!e.response) {
        // Ag kesintisi (ETIMEDOUT/ENOTFOUND/...): deneme hakkini yakmadan baglanti gelene kadar bekle.
        attempt--;
        netFails++;
        const w = Math.min(60, 5 * netFails);
        if (netFails === 1 || netFails % 10 === 0) console.warn(`Ag yok (${e.code}), ${w}s sonra tekrar...`);
        await sleep(w * 1000);
        continue;
      }
      netFails = 0;
      console.warn(`Hata (${status}), tekrar deneniyor`);
      await sleep(3000);
    }
  }
  throw new Error(`Istek basarisiz: ${url}`);
}

// ---------------------------------------------------------------------------
// Takim adi normalizasyonu
// ---------------------------------------------------------------------------
const STOP = new Set(['fc', 'cf', 'sc', 'afc', 'club', 'de', 'the', 'ac', 'fk', 'sk']);
function tokens(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t && !STOP.has(t));
}
// football-data adi -> API adi (normalize edilmis, bosluksuz). Yanlis eslesmeyi
// onlemek icin kelime-kesisimi gibi gevsek kurallar KULLANILMAZ.
const ALIASES = {
  atlantautd: 'atlantaunited',
  losangelesgalaxy: 'lagalaxy',
};
function key(name) {
  const k = tokens(name).join('');
  return ALIASES[k] ?? k;
}
function sameTeam(a, b) {
  const ka = key(a);
  const kb = key(b);
  return ka === kb || ka.includes(kb) || kb.includes(ka);
}

async function main() {
  const db = new DatabaseSync(DB_PATH);
  const rows = db
    .prepare(
      `SELECT id, utc_date, home_team_name, away_team_name FROM matches
       WHERE league_id = ? AND season = ? AND status = 'finished' AND ht_home IS NULL`,
    )
    .all(LEAGUE_ID, SEASON);
  console.log(`DB: ${rows.length} maca IY gerekiyor (lig ${LEAGUE_ID}, sezon ${SEASON})`);
  if (rows.length === 0) return;

  let cache = {};
  if (fs.existsSync(CACHE)) cache = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  const saveCache = () => fs.writeFileSync(CACHE, JSON.stringify(cache));

  // 1) Yarisma + sezon
  if (!cache.list) {
    const comps = await get('/competitions', { search: COMP_NAME });
    const comp = comps.data.find((c) => c.name === COMP_NAME) ?? comps.data[0];
    if (!comp) throw new Error(`Yarisma bulunamadi: ${COMP_NAME}`);
    const seasons = await get(`/competitions/${comp.id}/seasons`);
    const season = seasons.data.find((s) => s.start_year === SEASON);
    if (!season) throw new Error(`Sezon bulunamadi: ${SEASON}`);
    console.log(`API: ${comp.id} / ${season.id} (${season.name})`);

    const list = [];
    for (let page = 1; ; page++) {
      const res = await get('/matches', {
        competition_id: comp.id,
        season_id: season.id,
        status: 'finished',
        per_page: 100,
        page,
      });
      list.push(...res.data);
      console.log(`  liste sayfa ${page}/${res.meta.total_pages}`);
      if (page >= res.meta.total_pages) break;
    }
    cache.list = list;
    cache.details = {};
    saveCache();
  }

  // 2) Eslestirme
  const used = new Set();
  const pairs = [];
  const unmatched = [];
  for (const r of rows) {
    const t = Date.parse(r.utc_date);
    const cand = cache.list.filter(
      (m) =>
        !used.has(m.id) &&
        Math.abs(Date.parse(m.utc_date) - t) <= 36 * 3600 * 1000 &&
        sameTeam(m.home_team.name, r.home_team_name) &&
        sameTeam(m.away_team.name, r.away_team_name),
    );
    if (cand.length >= 1) {
      cand.sort(
        (a, b) => Math.abs(Date.parse(a.utc_date) - t) - Math.abs(Date.parse(b.utc_date) - t),
      );
      used.add(cand[0].id);
      pairs.push({ dbId: r.id, apiId: cand[0].id });
    } else {
      unmatched.push(r);
    }
  }
  console.log(`Eslesen: ${pairs.length}, eslesmeyen: ${unmatched.length}`);
  unmatched.slice(0, 15).forEach((r) =>
    console.log(`  ? ${r.utc_date.slice(0, 10)} ${r.home_team_name} - ${r.away_team_name}`),
  );
  if (DRY) {
    const names = new Set();
    cache.list.forEach((m) => (names.add(m.home_team.name), names.add(m.away_team.name)));
    const dbNames = new Set();
    rows.forEach((r) => (dbNames.add(r.home_team_name), dbNames.add(r.away_team_name)));
    console.log('API takimlari:', [...names].sort().join(' | '));
    console.log('DB takimlari :', [...dbNames].sort().join(' | '));
    return;
  }

  // 3) Detaylar
  const upd = db.prepare(
    `UPDATE matches SET ht_home = ?, ht_away = ?, ht_fetched_at = ? WHERE id = ?`,
  );
  let done = 0;
  let written = 0;
  const toWrite = [];
  for (const p of pairs) {
    let d = cache.details[p.apiId];
    if (d === undefined) {
      const res = await get(`/matches/${p.apiId}`);
      const s = res?.data?.score;
      d = s ? { h: s.half_time_home ?? null, a: s.half_time_away ?? null } : { h: null, a: null };
      cache.details[p.apiId] = d;
      saveCache();
    }
    if (d.h != null && d.a != null) {
      // DB'ye ancak en sonda, tek transaction'da yazilir: Metro assets/betting.db'yi
      // izledigi icin cekim sirasindaki surekli yazma uygulamayi surekli yeniden yukler.
      toWrite.push([d.h, d.a, p.dbId]);
      written++;
    }
    done++;
    if (done % 20 === 0) console.log(`  ${done}/${pairs.length} (yazilan IY: ${written})`);
  }
  db.exec('BEGIN');
  for (const [h, a, id] of toWrite) upd.run(h, a, Date.now(), id);
  db.exec('COMMIT');
  console.log(`BITTI. Islenen: ${done}, IY yazilan: ${written}, IY'si API'de olmayan: ${done - written}`);
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
