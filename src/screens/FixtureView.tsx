import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import ApiLoadingBar from '../components/ApiLoadingBar';
import MatchCard, { type MatchCardExtras } from '../components/MatchCard';
import SyncProgressBar from '../components/SyncProgressBar';
import { useSyncProgress } from '../hooks/useSyncProgress';
import { getMatchesForLeagueSeason, type MatchRow } from '../db/matchesRepo';
import { getReversalStatsByTeam, type TeamReversalStats } from '../db/teamStatsRepo';
import { CURRENT_SEASON } from '../db/weekStatsRepo';
import {
  loadFixtureOdds,
  loadHalfTime,
  peekFixtureOdds,
  peekHalfTime,
  type HalfTime,
} from '../services/analysisApi';
import { enrichLeagueCurrentSeason } from '../services/fileLeagueEnrich';
import { describeApiError } from '../services/thestatsapi';
import {
  getLeagueFixtures,
  pickCurrentAndNextRound,
  type FixtureResult,
  type LeagueFixture,
} from '../services/fixtureService';
import type { FixtureOdds } from '../types/football';
import { buildCardFixture, type LeagueDisplayMeta } from '../utils/fixtureCards';
import { matchTeamName } from '../utils/teamMatch';
import leagueMetaJson from '../data/leagueMeta.json';

const LEAGUE_META = leagueMetaJson as unknown as Record<string, LeagueDisplayMeta>;

type Task = { id: string; kind: 'odds' | 'ht'; final: boolean };

/** Elle yenilemeler arasinda en az bu kadar sure (API limitini korumak icin). */
const MIN_MANUAL_REFRESH_MS = 2 * 60 * 1000;
/** Oran istekleri arasi bekleme: API sinirina (dakikada 12) uygun. */
const ODDS_GAP_MS = 5500;
const GUNLER = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const pad = (n: number) => String(n).padStart(2, '0');
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function tarihSaat(iso: string): { gun: string; saat: string } {
  const d = new Date(iso);
  return {
    gun: `${GUNLER[d.getDay()]} ${d.getDate()} ${AYLAR[d.getMonth()]}`,
    saat: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function aralik(list: LeagueFixture[]): string {
  if (list.length === 0) return '';
  const a = new Date(list[0].utcDate);
  const b = new Date(list[list.length - 1].utcDate);
  if (a.getDate() === b.getDate() && a.getMonth() === b.getMonth()) return `${a.getDate()} ${AYLAR[a.getMonth()]}`;
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${AYLAR[b.getMonth()]}`;
  return `${a.getDate()} ${AYLAR[a.getMonth()]} – ${b.getDate()} ${AYLAR[b.getMonth()]}`;
}

function guncellemeMetni(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Lig ekranindaki "Fikstur" sekmesi: icinde bulunulan hafta + bir sonraki hafta (mac kartlariyla). */
export default function FixtureView({ leagueId }: { leagueId: number }) {
  const [result, setResult] = useState<FixtureResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);

  const [teamStats, setTeamStats] = useState<TeamReversalStats | null>(null);
  const [dbRows, setDbRows] = useState<MatchRow[]>([]);
  const [dbReady, setDbReady] = useState(false);

  const [oddsMap, setOddsMap] = useState<Record<string, FixtureOdds | null>>({});
  const [htMap, setHtMap] = useState<Record<string, HalfTime | null>>({});
  const [oddsProg, setOddsProg] = useState<{ done: number; total: number } | null>(null);
  const [oddsErr, setOddsErr] = useState<string | null>(null);

  const yukle = useCallback(
    async (force: boolean) => {
      setLoading(true);
      setHata(null);
      setBilgi(null);
      try {
        setResult(await getLeagueFixtures(leagueId, { force }));
      } catch (e) {
        setHata(describeApiError(e));
      } finally {
        setLoading(false);
      }
    },
    [leagueId],
  );

  useEffect(() => {
    setResult(null);
    setOddsMap({});
    setHtMap({});
    yukle(false);
  }, [yukle]);

  // Dosyada IY verisi eksik olan liglerde (Arjantin, Brezilya, Cin, Japonya, MLS...) bu
  // sezonun eksik IY/oranlarini arka planda API'den tamamlar — yoksa 1/2-2/1 rozetleri bu
  // liglerde hep "0" gorunur (veri eksik oldugu icin, gercekten sifir oldugundan degil).
  const sync = useSyncProgress();
  const [enrichErr, setEnrichErr] = useState<string | null>(null);
  useEffect(() => {
    setEnrichErr(null);
    enrichLeagueCurrentSeason(leagueId).catch((e) => setEnrichErr(describeApiError(e)));
  }, [leagueId]);

  // Senkron bitince (arka plan dolgusu tamamlaninca) rozet sayilarini yeniden okur.
  const [reloadTick, setReloadTick] = useState(0);
  const wasSyncActive = useRef(false);
  useEffect(() => {
    if (wasSyncActive.current && !sync.active) setReloadTick((t) => t + 1);
    wasSyncActive.current = sync.active;
  }, [sync.active]);

  // Yerel DB: takim bazli 1/2+2/1 sayilari ve bu sezonun oynanmis maclari (API istegi yok)
  useEffect(() => {
    let iptal = false;
    Promise.all([
      getReversalStatsByTeam(leagueId, CURRENT_SEASON),
      getMatchesForLeagueSeason(leagueId, CURRENT_SEASON),
    ])
      .then(([st, rows]) => {
        if (iptal) return;
        setTeamStats(st);
        setDbRows(rows);
        setDbReady(true);
      })
      .catch((e) => console.warn('[Fikstur] DB okunamadi:', e));
    return () => {
      iptal = true;
    };
  }, [leagueId, reloadTick]);

  const rounds = useMemo(() => (result ? pickCurrentAndNextRound(result.fixtures) : []), [result]);

  /**
   * DB'de karsiligi olan oynanmis maclar (IY + oran DB'den gelir) ile olmayanlari ayirir.
   * Ayni eslestirme kartlarda da kullanilir.
   */
  const dbIndex = useMemo(() => {
    const rowsByPair = new Map<string, MatchRow>();
    for (const r of dbRows) rowsByPair.set(`${r.home_team_name}|${r.away_team_name}`, r);
    const resolve = (apiName: string) =>
      teamStats ? matchTeamName(apiName, teamStats.teams, leagueId) : null;

    const lookup = (f: LeagueFixture) => {
      const homeDb = resolve(f.homeName);
      const awayDb = resolve(f.awayName);
      let row: MatchRow | null = null;
      if (homeDb && awayDb && f.status === 'finished') {
        const r = rowsByPair.get(`${homeDb}|${awayDb}`);
        if (r && Math.abs(Date.parse(r.utc_date) - Date.parse(f.utcDate)) <= 36 * 3600 * 1000) row = r;
      }
      return { homeDb, awayDb, row };
    };
    return { lookup };
  }, [dbRows, teamStats, leagueId]);

  /**
   * API'den alinacak isler (sirayla): oynanmamis macin orani; DB'de olmayan oynanmis macin
   * IY skoru + orani. Hafta sirasi korunur (bu hafta once).
   */
  const tasks = useMemo(() => {
    const list: Task[] = [];
    if (!dbReady) return list;
    for (const round of rounds) {
      for (const f of round.fixtures) {
        if (f.status === 'scheduled') {
          list.push({ id: f.id, kind: 'odds', final: false });
        } else if (f.status === 'finished' && !dbIndex.lookup(f).row) {
          list.push({ id: f.id, kind: 'ht', final: true });
          list.push({ id: f.id, kind: 'odds', final: true });
        }
      }
    }
    return list;
  }, [rounds, dbReady, dbIndex]);
  const tasksKey = tasks.map((t) => `${t.kind}:${t.id}`).join(',');

  useEffect(() => {
    if (tasks.length === 0) return;
    let iptal = false;
    setOddsErr(null);

    (async () => {
      // 1) Onbellekteki her seyi hemen goster; taze olmayanlar siraya girer
      const pending: Task[] = [];
      const oddsInit: Record<string, FixtureOdds | null> = {};
      const htInit: Record<string, HalfTime | null> = {};
      for (const t of tasks) {
        if (t.kind === 'odds') {
          const c = await peekFixtureOdds(t.id, t.final);
          if (c) oddsInit[t.id] = c.odds;
          if (!c || !c.fresh) pending.push(t);
        } else {
          const c = await peekHalfTime(t.id);
          if (c) htInit[t.id] = c.ht;
          if (!c || !c.fresh) pending.push(t);
        }
      }
      if (iptal) return;
      setOddsMap((prev) => ({ ...prev, ...oddsInit }));
      setHtMap((prev) => ({ ...prev, ...htInit }));
      if (pending.length === 0) {
        setOddsProg(null);
        return;
      }

      // 2) Eksikleri API sinirina uygun aralikla sirayla al
      setOddsProg({ done: 0, total: pending.length });
      let done = 0;
      for (const t of pending) {
        if (iptal) return;
        let network = false;
        try {
          if (t.kind === 'odds') {
            const r = await loadFixtureOdds(t.id, t.final);
            if (iptal) return;
            setOddsMap((prev) => ({ ...prev, [t.id]: r.odds }));
            network = r.network;
          } else {
            const r = await loadHalfTime(t.id);
            if (iptal) return;
            setHtMap((prev) => ({ ...prev, [t.id]: r.ht }));
            network = r.network;
          }
        } catch (e) {
          if (!iptal) setOddsErr(describeApiError(e));
          break;
        }
        done++;
        setOddsProg({ done, total: pending.length });
        if (network && done < pending.length) await sleep(ODDS_GAP_MS);
      }
      if (!iptal) setOddsProg(null);
    })();

    return () => {
      iptal = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasksKey]);

  const meta = LEAGUE_META[String(leagueId)];

  const cards = useMemo(() => {
    // DB'de olmayan ama API'den IY'si gelen oynanmis maclardaki 1/2 / 2/1'ler dairelere eklenir
    const extra = new Map<string, number>();
    if (teamStats) {
      for (const round of rounds) {
        for (const f of round.fixtures) {
          if (f.status !== 'finished' || f.homeScore == null || f.awayScore == null) continue;
          const { homeDb, awayDb, row } = dbIndex.lookup(f);
          const ht = htMap[f.id];
          if (row || !ht || ht.home == null || ht.away == null || !homeDb || !awayDb) continue;
          const rev =
            (ht.home > ht.away && f.homeScore < f.awayScore) ||
            (ht.home < ht.away && f.homeScore > f.awayScore);
          if (rev) {
            extra.set(homeDb, (extra.get(homeDb) ?? 0) + 1);
            extra.set(awayDb, (extra.get(awayDb) ?? 0) + 1);
          }
        }
      }
    }
    const reversalOf = (dbName: string | null): number | null =>
      !teamStats || !teamStats.hasHt || dbName == null
        ? null
        : (teamStats.counts.get(dbName) ?? 0) + (extra.get(dbName) ?? 0);

    // Fikstur SADECE oynanacak (ya da canli) maclari gosterir; bitmis maclar
    // skorlariyla "Sonuclar" sekmesinde gorunmeli, burada degil.
    return rounds
      .map((round) => ({
        ...round,
        fixtures: round.fixtures.filter((f) => f.status !== 'finished'),
      }))
      .filter((round) => round.fixtures.length > 0)
      .map((round) => ({
        ...round,
        items: round.fixtures.map((f) => {
        const { homeDb, awayDb, row } = dbIndex.lookup(f);
        const t = tarihSaat(f.utcDate);
        const extras: MatchCardExtras = {
          scheduled: f.status === 'scheduled',
          kickoffTime: f.status === 'live' ? 'CANLI' : t.saat,
          dayLabel: t.gun,
          homeBadge: reversalOf(homeDb),
          awayBadge: reversalOf(awayDb),
          disableTeamPress: !(homeDb && awayDb),
        };
        const fixture = buildCardFixture({
          f,
          leagueId,
          season: CURRENT_SEASON,
          meta: meta ?? { name: '', country: '', logo: '', flag: null },
          dbRow: row,
          odds: oddsMap[f.id] ?? null,
          ht: htMap[f.id] ?? null,
          homeDbId: homeDb && teamStats ? teamStats.teamIds.get(homeDb) ?? null : null,
          awayDbId: awayDb && teamStats ? teamStats.teamIds.get(awayDb) ?? null : null,
        });
        return { f, fixture, extras };
      }),
    }));
  }, [rounds, teamStats, dbIndex, htMap, oddsMap, leagueId, meta]);

  const yenile = () => {
    if (result && Date.now() - result.fetchedAt < MIN_MANUAL_REFRESH_MS && !result.stale) {
      const kalan = Math.ceil((MIN_MANUAL_REFRESH_MS - (Date.now() - result.fetchedAt)) / 1000);
      setBilgi(`Veri yeni güncellendi. API limitini korumak için ${kalan} sn sonra tekrar deneyin.`);
      return;
    }
    yukle(true);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Gorunur yukleme gostergeleri */}
      <SyncProgressBar state={sync} />
      <ApiLoadingBar visible={loading} title="Fikstür sunucudan alınıyor…" />
      <ApiLoadingBar
        visible={!loading && oddsProg != null}
        title="İY ve oranlar alınıyor"
        progress={oddsProg ? { ...oddsProg, perItemMs: ODDS_GAP_MS } : undefined}
      />
      {enrichErr && <Text style={styles.warn}>Eksik veriler tamamlanamadı: {enrichErr}</Text>}

      {hata && !result && (
        <View style={styles.errBox}>
          <Text style={styles.errTitle}>Fikstür alınamadı</Text>
          <Text style={styles.errText}>{hata}</Text>
          <TouchableOpacity style={styles.btn} onPress={() => yukle(true)}>
            <Text style={styles.btnText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      )}

      {result && (
        <View style={styles.statusRow}>
          <Text style={styles.statusText}>
            Son güncelleme: {guncellemeMetni(result.fetchedAt)}
            {result.fromCache ? ' (önbellekten)' : ''}
          </Text>
          <TouchableOpacity onPress={yenile} disabled={loading} style={[styles.refresh, loading && { opacity: 0.4 }]}>
            <Text style={styles.refreshText}>↻ Yenile</Text>
          </TouchableOpacity>
        </View>
      )}
      {result?.stale && (
        <Text style={styles.warn}>
          Güncellenemedi ({result.error}). Önbellekteki eski veri gösteriliyor.
        </Text>
      )}
      {oddsErr && <Text style={styles.warn}>Oranlar alınamadı: {oddsErr}</Text>}
      {bilgi && <Text style={styles.info}>{bilgi}</Text>}
      {result && teamStats?.hasHt && (
        <Text style={styles.legend}>
          <Text style={styles.legendDot}>●</Text> Takımın bu sezon 1/2 veya 2/1 biten maç sayısı
        </Text>
      )}

      {result && cards.length === 0 && (
        <Text style={styles.empty}>Planlanmış yaklaşan maç bulunamadı (sezon arası olabilir).</Text>
      )}

      {cards.map((round) => (
        <View key={round.title} style={styles.roundBox}>
          <View style={styles.roundHead}>
            <Text style={styles.roundTitle}>{round.title}</Text>
            <Text style={styles.roundSub}>
              {aralik(round.fixtures)} · {round.fixtures.length} maç
            </Text>
          </View>
          {round.items.map(({ f, fixture, extras }) => (
            <MatchCard
              key={f.id}
              fixture={fixture}
              leagueId={leagueId}
              season={CURRENT_SEASON}
              extras={extras}
            />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F6FA' },
  content: { paddingBottom: 30 },
  errBox: { alignItems: 'center', padding: 24, gap: 8 },
  errTitle: { fontSize: 17, fontWeight: '700', color: '#555' },
  errText: { fontSize: 14, color: '#888', textAlign: 'center' },
  btn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: '#1A73E8' },
  btnText: { color: '#FFF', fontWeight: '700' },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: { fontSize: 11, color: '#888' },
  refresh: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#E8EEF9' },
  refreshText: { fontSize: 12, fontWeight: '700', color: '#1A73E8' },
  warn: { fontSize: 12, color: '#C62828', paddingHorizontal: 12, paddingBottom: 6 },
  info: { fontSize: 12, color: '#E65100', paddingHorizontal: 12, paddingBottom: 6 },
  legend: { fontSize: 11, color: '#777', paddingHorizontal: 12, paddingBottom: 4 },
  legendDot: { color: '#2E9E4F', fontSize: 13 },
  empty: { textAlign: 'center', color: '#888', padding: 30, fontSize: 14 },
  roundBox: { marginTop: 6 },
  roundHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 2,
    backgroundColor: '#E8EEF9',
  },
  roundTitle: { fontSize: 13, fontWeight: '800', color: '#1A73E8' },
  roundSub: { fontSize: 11, color: '#7A8599' },
});
