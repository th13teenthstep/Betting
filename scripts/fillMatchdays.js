#!/usr/bin/env node
/**
 * Dosya kaynakli (football-data) majör lig maclarinda bos olan `matchday`
 * (hafta numarasi) alanini TheStatsAPI'den doldurur -> assets/betting.db.
 *
 * Eslestirme: takim adlari kaynaklar arasinda farkli yazildigi icin (Man United /
 * Manchester United, Nott'm Forest ...) ana anahtar TARIH (+-36 saat) + MS SKORU.
 * Birden fazla aday kalirsa takim adi benzerligi ile daraltilir.
 *
 * Kullanim:
 *   node scripts/fillMatchdays.js [--season 2026] [--dry-run]
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const axios = require('axios');

try {
  const envText = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
} catch {
  /* ortam degiskenine guven */
}

const API_KEY = process.env.THESTATSAPI_KEY || process.env.EXPO_PUBLIC_THESTATSAPI_KEY;
const API = 'https://api.thestatsapi.com/api/football';
const GAP_MS = 5500;
const DB_PATH = path.join(__dirname, '..', 'assets', 'betting.db');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? def : process.argv[i + 1];
}
const SEASON = Number(arg('season', String(new Date().getFullYear())));
const DRY = process.argv.includes('--dry-run');

// DB lig id -> API'de aranacak ad + ulke
const LEAGUES = [
  { id: 39, search: 'Premier League', country: 'England' },
  { id: 140, search: 'La Liga', country: 'Spain', alt: 'LaLiga' },
  { id: 78, search: 'Bundesliga', country: 'Germany' },
  { id: 135, search: 'Serie A', country: 'Italy' },
];

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

function norm(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
/** Gevsek takim adi benzerligi: yalnizca belirsizlikte yardimci olarak kullanilir. */
function similar(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = na.split(' ').filter((t) => t.length > 2);
  const tb = nb.split(' ').filter((t) => t.length > 2);
  return ta.some((t) => tb.some((u) => u.startsWith(t.slice(0, 4)) || t.startsWith(u.slice(0, 4))));
}

async function findCompetition(l) {
  for (const q of [l.search, l.alt].filter(Boolean)) {
    const res = await get('/competitions', { search: q });
    const hit = res.data.find((c) => c.country === l.country && c.type === 'league');
    if (hit) return hit;
  }
  throw new Error(`Yarisma bulunamadi: ${l.search}`);
}

async function main() {
  const db = new DatabaseSync(DB_PATH);
  const upd = db.prepare(`UPDATE matches SET matchday = ? WHERE id = ?`);
  let totalUpdated = 0;
  const toWrite = [];

  for (const l of LEAGUES) {
    const rows = db
      .prepare(
        `SELECT id, utc_date, home_team_name, away_team_name, ft_home, ft_away
         FROM matches WHERE league_id = ? AND season = ? AND status = 'finished'`,
      )
      .all(l.id, SEASON);

    const comp = await findCompetition(l);
    const seasons = await get(`/competitions/${comp.id}/seasons`);
    const season = seasons.data.find((s) => s.start_year === SEASON);
    if (!season) throw new Error(`${l.search}: sezon ${SEASON} yok`);

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
      if (page >= res.meta.total_pages) break;
    }

    const used = new Set();
    let ok = 0;
    const bad = [];
    for (const r of rows) {
      const t = Date.parse(r.utc_date);
      let cand = list.filter(
        (m) =>
          !used.has(m.id) &&
          m.matchday != null &&
          Math.abs(Date.parse(m.utc_date) - t) <= 36 * 3600 * 1000 &&
          m.score.home === r.ft_home &&
          m.score.away === r.ft_away,
      );
      if (cand.length > 1) {
        const narrowed = cand.filter(
          (m) => similar(m.home_team.name, r.home_team_name) || similar(m.away_team.name, r.away_team_name),
        );
        if (narrowed.length >= 1) cand = narrowed;
      }
      if (cand.length > 1) {
        cand.sort((a, b) => Math.abs(Date.parse(a.utc_date) - t) - Math.abs(Date.parse(b.utc_date) - t));
      }
      if (cand.length === 0) {
        bad.push(r);
        continue;
      }
      used.add(cand[0].id);
      ok++;
      if (!DRY) toWrite.push([cand[0].matchday, r.id]);
    }
    totalUpdated += ok;
    console.log(
      `${l.search}: ${comp.id}/${season.id} — DB ${rows.length}, API ${list.length}, eslesen ${ok}, eslesmeyen ${bad.length}`,
    );
    bad.slice(0, 5).forEach((r) =>
      console.log(`   ? ${r.utc_date.slice(0, 10)} ${r.home_team_name} ${r.ft_home}-${r.ft_away} ${r.away_team_name}`),
    );
  }
  db.exec('BEGIN');
  for (const [md, id] of toWrite) upd.run(md, id);
  db.exec('COMMIT');
  console.log(`${DRY ? '(dry-run) ' : ''}Toplam ${totalUpdated} macin haftasi ${DRY ? 'bulundu' : 'yazildi'}.`);
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
