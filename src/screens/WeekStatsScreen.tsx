import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import {
  CURRENT_SEASON,
  ensureWeekStats,
  getSeasonsWithHt,
  getWeekStats,
  type WeekStatRow,
} from '../db/weekStatsRepo';
import SeasonPicker from '../components/SeasonPicker';
import { MOCK_COUNTRIES } from '../utils/mockData';

const LABEL_W = 132;
const CELL_W = 36;
const ROW_H = 34;
const COUNTRY_H = 26;

type Line =
  | { kind: 'country'; key: string; title: string }
  | { kind: 'league'; key: string; leagueId: number; name: string };

/**
 * Ulke > lig > hafta tablosu (IY verisi olan tum ligler). Hucre:
 *  ✓  o haftada en az bir 1/2 veya 2/1 oldu
 *  ✗  hafta tamamlandi, hic 1/2 / 2/1 olmadi
 *  ·  hafta henuz tamamlanmadi / IY'si eksik ve (simdilik) 1/2 / 2/1 yok
 *  –  o hafta icin veri yok
 */
export default function WeekStatsScreen() {
  const [season, setSeason] = useState(CURRENT_SEASON);
  const [seasons, setSeasons] = useState<number[]>([CURRENT_SEASON]);
  const [rows, setRows] = useState<WeekStatRow[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  // Sabit baslik satirindaki hafta numaralari, govdenin yatay kaymasini takip eder.
  const headRef = useRef<ScrollView>(null);

  useEffect(() => {
    getSeasonsWithHt()
      .then((list) => list.length > 0 && setSeasons(list))
      .catch((e) => console.warn('[WeekStats] sezon listesi hatasi:', e));
  }, []);

  useEffect(() => {
    let iptal = false;
    setRows(null);
    setHata(null);
    (async () => {
      try {
        await ensureWeekStats(season);
        const data = await getWeekStats(season);
        if (!iptal) setRows(data);
      } catch (e) {
        console.warn('[WeekStats] hata:', e);
        if (!iptal) {
          setHata(e instanceof Error ? e.message : String(e));
          setRows([]);
        }
      }
    })();
    return () => {
      iptal = true;
    };
  }, [season]);

  const { lines, byLeague, weekCount, fullSize, lastWeek } = useMemo(() => {
    const map = new Map<number, Map<number, WeekStatRow>>();
    const full = new Map<number, number>(); // lig -> tipik hafta buyuklugu (medyan)
    const last = new Map<number, number>(); // lig -> son hafta
    const sizes = new Map<number, number[]>();
    const hasHt = new Set<number>();
    let max = 0;
    for (const r of rows ?? []) {
      if (!map.has(r.league_id)) map.set(r.league_id, new Map());
      map.get(r.league_id)!.set(r.matchday, r);
      last.set(r.league_id, Math.max(last.get(r.league_id) ?? 0, r.matchday));
      if (!sizes.has(r.league_id)) sizes.set(r.league_id, []);
      sizes.get(r.league_id)!.push(r.matches_total);
      if (r.matches_with_ht > 0) hasHt.add(r.league_id);
    }
    // Sadece IY verisi olan liglerin hafta sayisi tabloyu belirler.
    for (const id of hasHt) {
      for (const w of map.get(id)!.keys()) max = Math.max(max, w);
    }

    for (const [id, arr] of sizes) {
      arr.sort((a, b) => a - b);
      full.set(id, arr[Math.floor(arr.length / 2)]);
    }

    const out: Line[] = [];
    for (const c of MOCK_COUNTRIES) {
      const leagues = c.leagues.filter((l) => hasHt.has(l.id));
      if (leagues.length === 0) continue;
      out.push({ kind: 'country', key: `c-${c.code}`, title: `${c.flag} ${c.name}` });
      for (const l of leagues) {
        out.push({ kind: 'league', key: `l-${l.id}`, leagueId: l.id, name: l.name });
      }
    }
    return { lines: out, byLeague: map, weekCount: max, fullSize: full, lastWeek: last };
  }, [rows]);

  const seasonBar = (
    <View style={styles.seasonBar}>
      <SeasonPicker selected={season} seasons={seasons} onSelect={setSeason} />
    </View>
  );

  if (rows === null) {
    return (
      <View style={styles.screen}>
        {seasonBar}
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1A73E8" />
        </View>
      </View>
    );
  }

  if (weekCount === 0) {
    return (
      <View style={styles.screen}>
        {seasonBar}
        <View style={styles.center}>
          <Text style={styles.empty}>
            {hata ? `Veri okunurken bir hata oluştu.
${hata}` : 'Bu sezon için İY verisi bulunamadı.'}
          </Text>
        </View>
      </View>
    );
  }

  const weeks = Array.from({ length: weekCount }, (_, i) => i + 1);

  return (
    <View style={styles.screen}>
      {seasonBar}
      <Text style={styles.info}>✓ en az bir 1/2 veya 2/1 · ✗ hiç yok · · hafta devam ediyor</Text>

      {/* Hafta numaralari: dikey kaydirmanin DISINDA, her zaman gorunur. */}
      <View style={styles.headerRow}>
        <View style={[styles.labelCell, styles.headCell]}>
          <Text style={styles.headText}>Lig / Hafta</Text>
        </View>
        <ScrollView
          ref={headRef}
          horizontal
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          style={styles.headScroll}
        >
          {weeks.map((w) => (
            <View key={w} style={[styles.cell, styles.headCell]}>
              <Text style={styles.headText}>{w}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.table}>
          {/* Sabit sol sutun (lig adlari) */}
          <View>
            {lines.map((ln) =>
              ln.kind === 'country' ? (
                <View key={ln.key} style={[styles.labelCell, styles.countryCell]}>
                  <Text style={styles.countryText} numberOfLines={1}>
                    {ln.title}
                  </Text>
                </View>
              ) : (
                <View key={ln.key} style={styles.labelCell}>
                  <Text style={styles.labelText} numberOfLines={2}>
                    {ln.name}
                  </Text>
                </View>
              ),
            )}
          </View>

          {/* Yatay kaydirilabilir hafta hucreleri; kaydikca baslik satirini da kaydirir */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            scrollEventThrottle={16}
            onScroll={(e) =>
              headRef.current?.scrollTo({ x: e.nativeEvent.contentOffset.x, animated: false })
            }
            style={styles.bodyScroll}
          >
            <View>
              {lines.map((ln) =>
                ln.kind === 'country' ? (
                  <View key={ln.key} style={[styles.row, styles.countryRow]} />
                ) : (
                  <View key={ln.key} style={styles.row}>
                    {weeks.map((w) => (
                      <View key={w} style={styles.cell}>
                        {renderCell(
                          byLeague.get(ln.leagueId)?.get(w),
                          // Sadece guncel sezonun son haftasi "devam ediyor" olabilir.
                          season === CURRENT_SEASON &&
                            w === lastWeek.get(ln.leagueId) &&
                            (byLeague.get(ln.leagueId)?.get(w)?.matches_total ?? 0) <
                              (fullSize.get(ln.leagueId) ?? 0),
                        )}
                      </View>
                    ))}
                  </View>
                ),
              )}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

function renderCell(r: WeekStatRow | undefined, weekInProgress: boolean) {
  if (!r) return <Text style={styles.none}>–</Text>;
  if (r.count_12 + r.count_21 > 0) return <Text style={styles.yes}>✓</Text>;
  if (weekInProgress || r.matches_with_ht < r.matches_total) {
    return <Text style={styles.pending}>·</Text>;
  }
  return <Text style={styles.no}>✗</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F6FA', paddingHorizontal: 8 },
  seasonBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 10,
    marginHorizontal: -8,
    marginBottom: 8,
    backgroundColor: '#1A73E8',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 200 },
  empty: { color: '#666', fontSize: 15, textAlign: 'center', paddingHorizontal: 16 },
  info: { fontSize: 11, color: '#666', marginBottom: 6 },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#DCE7FA',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    overflow: 'hidden',
  },
  headScroll: { flex: 1 },
  bodyScroll: { flex: 1 },
  table: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    overflow: 'hidden',
    marginBottom: 20,
  },
  row: { flexDirection: 'row' },
  countryRow: { height: COUNTRY_H, backgroundColor: '#EEF3FD' },
  labelCell: {
    width: LABEL_W,
    height: ROW_H,
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEE',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#DDD',
  },
  countryCell: { height: COUNTRY_H, backgroundColor: '#EEF3FD' },
  countryText: { fontSize: 12, fontWeight: '800', color: '#1A73E8' },
  labelText: { fontSize: 12, fontWeight: '600', color: '#1A1A1A', paddingLeft: 6 },
  cell: {
    width: CELL_W,
    height: ROW_H,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEE',
  },
  headCell: { backgroundColor: '#DCE7FA' },
  headText: { fontSize: 12, fontWeight: '800', color: '#1A73E8' },
  yes: { fontSize: 18, fontWeight: '800', color: '#2E9E4F' },
  no: { fontSize: 16, fontWeight: '700', color: '#D64545' },
  pending: { fontSize: 20, fontWeight: '800', color: '#AAA' },
  none: { fontSize: 14, color: '#CCC' },
});
