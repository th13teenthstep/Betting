import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { AnalizStackParamList, FixtureOdds } from '../types/football';
import {
  filterSimilar,
  hasOpeningData,
  getSeasonsForLeague,
  loadSeasonsWithOdds,
  type OddsCriterion,
  OUTCOME_KEYS,
  type OddsMatchRow,
  type OddsTriple,
  type OutcomeKey,
} from '../db/analysisRepo';
import { rowToFixture } from '../db/matchesRepo';
import { CURRENT_SEASON } from '../db/weekStatsRepo';
import { fetchFixtureOdds } from '../services/analysisApi';
import { describeApiError } from '../services/thestatsapi';
import { computeStats, HTFT_ORDER } from '../utils/analysisStats';
import ToleranceChips from '../components/ToleranceChips';
import SeasonMultiSelect from '../components/SeasonMultiSelect';
import MatchCard from '../components/MatchCard';
import SyncProgressBar from '../components/SyncProgressBar';
import { useSyncProgress } from '../hooks/useSyncProgress';
import leagueMetaJson from '../data/leagueMeta.json';

type Route = RouteProp<AnalizStackParamList, 'AnalizDetail'>;
type MetaEntry = { name: string; country: string; logo: string; flag: string | null };
const LEAGUE_META = leagueMetaJson as unknown as Record<string, MetaEntry>;

const seasonLabel = (s: number) => `${s}/${String(s + 1).slice(-2)}`;
const MAX_LIST = 60;
const AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const OUTCOME_LABEL: Record<OutcomeKey, string> = { home: '1', draw: 'X', away: '2' };

type SearchMode = 'opening' | 'closing' | 'both';
const SEARCH_MODE_LABEL: Record<SearchMode, string> = {
  opening: 'Açılışa göre',
  closing: 'Kapanışa göre',
  both: 'Her ikisine göre',
};

function kisaTarih(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${AYLAR[d.getMonth()]}`;
}
const pct = (n: number, d: number) => (d > 0 ? Math.round((100 * n) / d) : 0);
const fmt = (v: number | null | undefined) => (v != null ? v.toFixed(2) : '–');

function triple(odds: FixtureOdds | null | undefined, kind: 'opening' | 'closing'): OddsTriple {
  return {
    home: odds?.home[kind] ?? null,
    draw: odds?.draw[kind] ?? null,
    away: odds?.away[kind] ?? null,
  };
}
const hasAny = (t: OddsTriple) => OUTCOME_KEYS.some((k) => t[k] != null);

/** Analiz – 3. adim: secili macin oranlarina benzer gecmis maclar + IY/MS istatistigi. */
export default function AnalizDetailScreen() {
  const { leagueId, leagueName, teamName, fixtures } = useRoute<Route>().params;

  const [idx, setIdx] = useState(0);
  const [oddsMap, setOddsMap] = useState<Record<string, FixtureOdds | null>>({});
  const [oddsLoading, setOddsLoading] = useState(true);
  const [oddsErr, setOddsErr] = useState<string | null>(null);
  const [all, setAll] = useState<OddsMatchRow[] | null>(null);

  const [availableSeasons, setAvailableSeasons] = useState<number[]>([CURRENT_SEASON]);
  const [selectedSeasons, setSelectedSeasons] = useState<number[]>([CURRENT_SEASON]);

  // Arama modu hangi kriter(ler)in aktif oldugunu belirler; her kriterin kendi
  // toleransi var. "both" secilince mac HER IKISINI birden saglamali (AND).
  // Her kriterin icinde 1, X, 2 de birlikte eslesir (AND).
  const [searchMode, setSearchMode] = useState<SearchMode>('opening');
  const [openTol, setOpenTol] = useState(0.1);
  const [closeTol, setCloseTol] = useState(0.1);

  // Bu lig icin DB'deki sezonlar; guncel sezon yoksa en yenisi secilir
  useEffect(() => {
    let iptal = false;
    getSeasonsForLeague(leagueId).then((list) => {
      if (iptal || list.length === 0) return;
      setAvailableSeasons(list);
      setSelectedSeasons((prev) => {
        const kept = prev.filter((x) => list.includes(x));
        return kept.length > 0 ? kept : [list[0]];
      });
    });
    return () => {
      iptal = true;
    };
  }, [leagueId]);

  // Arka plan dolgusu (IY + oran) bitince veriyi yeniden oku
  const sync = useSyncProgress();
  const [reloadTick, setReloadTick] = useState(0);
  const wasActive = useRef(false);
  useEffect(() => {
    if (wasActive.current && !sync.active) setReloadTick((t) => t + 1);
    wasActive.current = sync.active;
  }, [sync.active]);

  // Secili sezonlarin bitmis maclari (yerel DB). Yeniden okumada (dolgu bitti) ekran bos kalmasin.
  const seasonKey = selectedSeasons.join(',');
  const loadedKey = useRef('');
  useEffect(() => {
    let iptal = false;
    const key = `${leagueId}|${seasonKey}`;
    if (loadedKey.current !== key) setAll(null);
    loadSeasonsWithOdds(leagueId, selectedSeasons).then((rows) => {
      if (iptal) return;
      loadedKey.current = key;
      setAll(rows);
    });
    return () => {
      iptal = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId, seasonKey, reloadTick]);

  // Yaklasan maclarin oranlari (API) – sirayla, hata olursa nedenini goster
  useEffect(() => {
    let iptal = false;
    (async () => {
      try {
        for (const f of fixtures) {
          const odds = await fetchFixtureOdds(f.id);
          if (iptal) return;
          setOddsMap((prev) => ({ ...prev, [f.id]: odds }));
        }
      } catch (e) {
        if (!iptal) setOddsErr(describeApiError(e));
      } finally {
        if (!iptal) setOddsLoading(false);
      }
    })();
    return () => {
      iptal = true;
    };
  }, [fixtures]);

  const openingAvailable = all ? hasOpeningData(all) : true;
  // Bu ligde gecmis maclarin acilis orani hic yoksa "acilis" iceren modlar secilemez
  useEffect(() => {
    if (all && !openingAvailable && searchMode !== 'closing') setSearchMode('closing');
  }, [all, openingAvailable, searchMode]);

  const fixture = fixtures[idx];
  const odds = oddsMap[fixture.id];
  const openTarget = triple(odds, 'opening');
  const closeTarget = triple(odds, 'closing');

  const openActive = searchMode === 'opening' || searchMode === 'both';
  const closeActive = searchMode === 'closing' || searchMode === 'both';
  // Etkin (tolerans acik) bir kriterin bu mac icin hic verisi yoksa (statsapi getiremedi)
  // karsilastirma yapilamaz; bunu "kriter kapali" ile karistirmamak icin 0 sonuc donuyoruz.
  const openMissing = openActive && !hasAny(openTarget);
  const closeMissing = closeActive && !hasAny(closeTarget);

  const matched = useMemo(() => {
    if (!all) return [];
    if (openMissing || closeMissing) return [];
    const OFF: OddsCriterion = {
      target: { home: null, draw: null, away: null },
      tolerance: null,
    };
    return filterSimilar(all, {
      opening: openActive ? { target: openTarget, tolerance: openTol } : OFF,
      closing: closeActive ? { target: closeTarget, tolerance: closeTol } : OFF,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, openTarget, closeTarget, openActive, closeActive, openMissing, closeMissing, openTol, closeTol]);

  const stats = useMemo(() => computeStats(matched), [matched]);

  const meta = LEAGUE_META[String(leagueId)];

  const noOdds = !oddsLoading && !hasAny(openTarget) && !hasAny(closeTarget);

  return (
    <View style={styles.screen}>
      {/* Mac secici + oranlar: her zaman gorunur kalsin diye scroll disinda sabit */}
      <View style={styles.stickyHeader}>
        <View style={styles.fixturePicker}>
          <TouchableOpacity
            disabled={idx === 0}
            onPress={() => setIdx((i) => Math.max(0, i - 1))}
            activeOpacity={0.7}
            style={[styles.fixtureNavBtn, idx === 0 && styles.fixtureNavBtnDisabled]}
          >
            <Text style={styles.fixtureNavIcon}>‹</Text>
          </TouchableOpacity>
          <View style={styles.fixtureCurrent}>
            <Text style={styles.fixtureCurrentText} numberOfLines={1}>
              {fixture.homeName} - {fixture.awayName}
            </Text>
            <Text style={styles.fixtureCurrentDate} numberOfLines={1}>
              {kisaTarih(fixture.utcDate)}
              {fixture.matchday != null ? ` · ${fixture.matchday}. hafta` : ''}
              {fixtures.length > 1 ? `  ·  ${idx + 1}/${fixtures.length}` : ''}
            </Text>
          </View>
          <TouchableOpacity
            disabled={idx === fixtures.length - 1}
            onPress={() => setIdx((i) => Math.min(fixtures.length - 1, i + 1))}
            activeOpacity={0.7}
            style={[styles.fixtureNavBtn, idx === fixtures.length - 1 && styles.fixtureNavBtnDisabled]}
          >
            <Text style={styles.fixtureNavIcon}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.oddsCardCompact}>
          <View style={styles.oddsLineCompact}>
            <Text style={[styles.oddsLabel, styles.oddsCol0]}>Açılış</Text>
            {OUTCOME_KEYS.map((k) => (
              <Text key={k} style={styles.oddsHeadText}>{OUTCOME_LABEL[k]}</Text>
            ))}
          </View>
          <View style={styles.oddsLineCompact}>
            <Text style={[styles.oddsLabel, styles.oddsCol0]} />
            {OUTCOME_KEYS.map((k) => (
              <Text key={k} style={styles.oddsVal}>{fmt(openTarget[k])}</Text>
            ))}
          </View>
          <View style={styles.oddsLineCompact}>
            <Text style={[styles.oddsLabel, styles.oddsCol0]}>Kapanış</Text>
            {OUTCOME_KEYS.map((k) => (
              <Text key={k} style={[styles.oddsVal, styles.oddsValBold]}>{fmt(closeTarget[k])}</Text>
            ))}
          </View>
          {oddsLoading && <Text style={styles.noteGrey}>Oranlar yükleniyor…</Text>}
          {oddsErr && <Text style={styles.noteRed}>Oranlar alınamadı: {oddsErr}</Text>}
          {noOdds && !oddsErr && <Text style={styles.noteGrey}>Bu maç için henüz Bet365 oranı yok.</Text>}
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <SyncProgressBar state={sync} />
        <Text style={styles.title}>{teamName}</Text>
        <Text style={styles.sub}>
          {leagueName} ·{' '}
          {selectedSeasons.length === 1
            ? `${seasonLabel(selectedSeasons[0])} sezonu`
            : `${selectedSeasons.length} sezon (${seasonLabel(selectedSeasons[selectedSeasons.length - 1])} – ${seasonLabel(selectedSeasons[0])})`}
        </Text>

        {/* Filtreler */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Benzer maçları bul</Text>
        <Text style={[styles.label, { marginTop: 8, marginBottom: 4 }]}>
          Sezonlar ({selectedSeasons.length} seçili)
        </Text>
        <SeasonMultiSelect
          seasons={availableSeasons}
          selected={selectedSeasons}
          onChange={setSelectedSeasons}
        />
        <Text style={[styles.label, { marginTop: 10, marginBottom: 6 }]}>Arama modu</Text>
        <View style={styles.modeRow}>
          {(['opening', 'closing', 'both'] as SearchMode[]).map((m) => {
            const disabled = !openingAvailable && m !== 'closing';
            return (
              <TouchableOpacity
                key={m}
                disabled={disabled}
                onPress={() => setSearchMode(m)}
                activeOpacity={0.7}
                style={[
                  styles.modeOptBtn,
                  searchMode === m && styles.modeOptBtnActive,
                  disabled && styles.modeOptBtnDisabled,
                ]}
              >
                <Text style={[styles.modeOptText, searchMode === m && styles.modeOptTextActive]}>
                  {SEARCH_MODE_LABEL[m]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {!openingAvailable && (
          <Text style={styles.noteGrey}>Bu ligde geçmiş maçların açılış oranı verisi yok.</Text>
        )}
        <Text style={[styles.label, { marginTop: 10 }]}>
          0.00 = birebir aynı oran; diğer değerler ± oran farkı toleransıdır.
        </Text>
        {openActive && (
          <ToleranceChips
            label="Açılış toleransı (1 · X · 2 birlikte)"
            value={openTol}
            onChange={setOpenTol}
            note={openMissing ? 'Bu maçın açılış oranı bulunamadı.' : undefined}
          />
        )}
        {closeActive && (
          <ToleranceChips
            label="Kapanış toleransı (1 · X · 2 birlikte)"
            value={closeTol}
            onChange={setCloseTol}
            note={closeMissing ? 'Bu maçın kapanış oranı bulunamadı.' : undefined}
          />
        )}
      </View>

      {/* Sonuc */}
      {all === null ? (
        <ActivityIndicator style={{ marginTop: 20 }} color="#1A73E8" />
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {stats.total} maç bulundu{' '}
              <Text style={styles.cardTitleLight}>(seçili sezonlarda {all.length} maç)</Text>
            </Text>

            {openMissing || closeMissing ? (
              <Text style={styles.noteGrey}>
                Bu maçın {[openMissing && 'açılış', closeMissing && 'kapanış'].filter(Boolean).join(' ve ')}{' '}
                oranı bulunamadığı için karşılaştırma yapılamıyor. Arama modunu değiştirip devam
                edebilirsiniz.
              </Text>
            ) : stats.total === 0 ? (
              <Text style={styles.noteGrey}>
                Bu aralıkta maç yok. Toleransı artırmayı deneyin.
              </Text>
            ) : (
              <>
                <View style={styles.reversalBox}>
                  <Text style={styles.reversalTitle}>1/2 + 2/1 (ters dönüş)</Text>
                  <Text style={styles.reversalValue}>
                    {stats.reversals}
                    <Text style={styles.reversalPct}>
                      {'  '}
                      {stats.withHt > 0 ? `%${pct(stats.reversals, stats.withHt)}` : 'İY verisi yok'}
                    </Text>
                  </Text>
                </View>

                <Text style={[styles.label, { marginTop: 12 }]}>
                  İY/MS dağılımı{stats.withHt < stats.total ? ` (İY'si bilinen ${stats.withHt} maç)` : ''}
                </Text>
                {HTFT_ORDER.map((k) => {
                  const n = stats.htft[k];
                  const p = pct(n, stats.withHt);
                  const rev = k === '1/2' || k === '2/1';
                  return (
                    <View key={k} style={styles.barRow}>
                      <Text style={[styles.barLabel, rev && styles.barLabelRev]}>{k}</Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            { width: `${p}%` },
                            rev && styles.barFillRev,
                          ]}
                        />
                      </View>
                      <Text style={styles.barNum}>{n}</Text>
                      <Text style={styles.barPct}>%{p}</Text>
                    </View>
                  );
                })}

                <Text style={[styles.label, { marginTop: 12 }]}>MS sonucu</Text>
                <View style={styles.msRow}>
                  <View style={styles.msBox}>
                    <Text style={styles.msVal}>{stats.ft.home}</Text>
                    <Text style={styles.msLab}>Ev (%{pct(stats.ft.home, stats.total)})</Text>
                  </View>
                  <View style={styles.msBox}>
                    <Text style={styles.msVal}>{stats.ft.draw}</Text>
                    <Text style={styles.msLab}>Beraberlik (%{pct(stats.ft.draw, stats.total)})</Text>
                  </View>
                  <View style={styles.msBox}>
                    <Text style={styles.msVal}>{stats.ft.away}</Text>
                    <Text style={styles.msLab}>Deplasman (%{pct(stats.ft.away, stats.total)})</Text>
                  </View>
                </View>
                <Text style={styles.goals}>
                  Ortalama gol: {stats.avgGoals != null ? stats.avgGoals.toFixed(2) : '–'}
                </Text>
              </>
            )}
          </View>

          {stats.total > 0 && meta && (
            <>
              <Text style={styles.listTitle}>Eşleşen maçlar</Text>
              {matched.slice(0, MAX_LIST).map((r) => (
                <MatchCard
                  key={r.id}
                  fixture={rowToFixture(r, { name: meta.name, country: meta.country, logo: meta.logo, flag: meta.flag })}
                  leagueId={leagueId}
                  season={r.season}
                />
              ))}
              {matched.length > MAX_LIST && (
                <Text style={styles.noteGrey}>… ve {matched.length - MAX_LIST} maç daha (ilk {MAX_LIST} gösteriliyor)</Text>
              )}
            </>
          )}
        </>
      )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F6FA' },
  scroll: { flex: 1 },
  content: { padding: 8, paddingBottom: 40 },
  stickyHeader: {
    backgroundColor: '#F5F6FA',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E3E5EA',
    // Android: elevation gives it a subtle shadow so it visually separates from the scrolling content below.
    elevation: 2,
    zIndex: 1,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#1A1A1A', paddingHorizontal: 4 },
  sub: { fontSize: 12, color: '#777', marginBottom: 8, paddingHorizontal: 4 },
  fixturePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginBottom: 6,
  },
  fixtureNavBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixtureNavBtnDisabled: { opacity: 0.3 },
  fixtureNavIcon: { fontSize: 16, fontWeight: '800', color: '#1A73E8', lineHeight: 18 },
  fixtureCurrent: { flex: 1, alignItems: 'center' },
  fixtureCurrentText: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  fixtureCurrentDate: { fontSize: 11, color: '#777', marginTop: 1 },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 12, marginBottom: 8 },
  oddsCardCompact: { backgroundColor: '#FFF', borderRadius: 10, paddingVertical: 4, paddingHorizontal: 10 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#1A1A1A' },
  cardTitleLight: { fontSize: 12, fontWeight: '500', color: '#888' },
  label: { fontSize: 12, fontWeight: '700', color: '#555' },
  oddsLineCompact: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  oddsCol0: { width: 64 },
  oddsLabel: { fontSize: 12, color: '#777' },
  oddsHeadText: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '800', color: '#1A73E8' },
  oddsVal: { flex: 1, textAlign: 'center', fontSize: 15, color: '#555', fontVariant: ['tabular-nums'] },
  oddsValBold: { fontWeight: '800', color: '#111' },
  modeRow: { flexDirection: 'row', gap: 6 },
  modeOptBtn: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  modeOptBtnActive: { backgroundColor: '#1A73E8' },
  modeOptBtnDisabled: { opacity: 0.4 },
  modeOptText: { fontSize: 12, fontWeight: '700', color: '#555' },
  modeOptTextActive: { color: '#FFF' },
  noteGrey: { fontSize: 12, color: '#888', marginTop: 6 },
  noteRed: { fontSize: 12, color: '#C62828', marginTop: 6 },
  reversalBox: {
    marginTop: 10,
    backgroundColor: '#FFF3E0',
    borderRadius: 10,
    padding: 10,
  },
  reversalTitle: { fontSize: 12, fontWeight: '700', color: '#E65100' },
  reversalValue: { fontSize: 26, fontWeight: '800', color: '#E65100' },
  reversalPct: { fontSize: 16, fontWeight: '700' },
  barRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 8 },
  barLabel: { width: 32, fontSize: 12, fontWeight: '700', color: '#555' },
  barLabelRev: { color: '#E65100' },
  barTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: '#EEF0F3', overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5, backgroundColor: '#90A4AE' },
  barFillRev: { backgroundColor: '#FB8C00' },
  barNum: { width: 26, textAlign: 'right', fontSize: 12, fontWeight: '700', color: '#333' },
  barPct: { width: 40, textAlign: 'right', fontSize: 11, color: '#777' },
  msRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  msBox: { flex: 1, backgroundColor: '#F5F6FA', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  msVal: { fontSize: 18, fontWeight: '800', color: '#222' },
  msLab: { fontSize: 10, color: '#777', marginTop: 2, textAlign: 'center' },
  goals: { fontSize: 12, color: '#666', marginTop: 10 },
  listTitle: { fontSize: 13, fontWeight: '800', color: '#555', marginTop: 6, marginBottom: 4, paddingHorizontal: 4 },
});
