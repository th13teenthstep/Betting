import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  SectionList,
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
} from 'react-native';
import type { HtFtFilter, Fixture } from '../types/football';
import { getHtFtOutcome } from '../utils/htftCalculator';
import { fetchFixtures, clearCache } from '../services/api';
import { useSyncProgress } from '../hooks/useSyncProgress';
import HtFtFilterBar from '../components/HtFtFilterBar';
import MatchCard from '../components/MatchCard';
import { withDerivedRounds } from '../utils/rounds';

const AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

/** "24 Eki" ya da "24 – 26 Eki" gibi kisa tarih araligi. */
function formatAralik(baslangicIso: string, bitisIso: string): string {
  const a = new Date(baslangicIso);
  const b = new Date(bitisIso);
  const ayni = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (ayni && a.getDate() === b.getDate()) return `${a.getDate()} ${AYLAR[a.getMonth()]}`;
  if (ayni) return `${a.getDate()}–${b.getDate()} ${AYLAR[b.getMonth()]}`;
  return `${a.getDate()} ${AYLAR[a.getMonth()]} – ${b.getDate()} ${AYLAR[b.getMonth()]}`;
}

interface Props {
  leagueId: number;
  season: number;
  /** Opsiyonel – sadece bu takimin maclari gosterilir. */
  takimId?: number;
}

/**
 * Sonuclar & IY/MS Istatistikleri gorunumu.
 *
 * 1. API'den bitmis maclari ceker.
 * 2. Her maca istemci tarafinda `htFtResult` ekler.
 * 3. Kullanici filtre butonuna tiklayinca listede aninda filtreleme yapar.
 * 4. `takimId` verilirse sadece o takimin maclari gosterilir.
 */
export default function HtFtResultsView({ leagueId, season, takimId }: Props) {
  const [filter, setFilter] = useState<HtFtFilter>('ALL');
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [bos, setBos] = useState(false);

  const syncProgress = useSyncProgress();
  const yenilemeZamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);

  const veriCek = useCallback(async (): Promise<Fixture[] | null> => {
    // Hafta numarasi tum lig uzerinden turetilir (takim filtresinden ONCE).
    const data = withDerivedRounds(await fetchFixtures(leagueId, season));

    // Takim filtresi varsa sadece o takimin maclarini al
    const filtrelenmemis =
      takimId != null
        ? data.filter((f) => f.teams.home.id === takimId || f.teams.away.id === takimId)
        : data;

    if (filtrelenmemis.length === 0) return null;

    return filtrelenmemis.map((fixture) => ({
      ...fixture,
      htFtResult: getHtFtOutcome(
        fixture.score?.halftime ?? { home: null, away: null },
        fixture.score?.fulltime ?? { home: null, away: null },
      ),
    }));
  }, [leagueId, season, takimId]);

  // Ilk yukleme (ekran acildiginda / lig-sezon-takim degistiginde)
  useEffect(() => {
    let iptalEdildi = false;

    clearCache(leagueId, season);

    async function yukle() {
      setLoading(true);
      setBos(false);
      try {
        const sonuc = await veriCek();
        if (iptalEdildi) return;
        if (sonuc === null) {
          setBos(true);
          setFixtures([]);
        } else {
          setFixtures(sonuc);
        }
      } catch (_err) {
        if (iptalEdildi) return;
        setBos(true);
      } finally {
        if (!iptalEdildi) setLoading(false);
      }
    }

    yukle();

    return () => {
      iptalEdildi = true;
    };
  }, [leagueId, season, takimId, veriCek]);

  // Arka plan senkronu IY/oran verisi yazdikca listeyi sessizce guncelle (debounce'lu).
  useEffect(() => {
    if (loading || bos) return;

    if (yenilemeZamanlayici.current) clearTimeout(yenilemeZamanlayici.current);
    yenilemeZamanlayici.current = setTimeout(async () => {
      const sonuc = await veriCek();
      if (sonuc !== null) setFixtures(sonuc);
    }, 2000);

    return () => {
      if (yenilemeZamanlayici.current) clearTimeout(yenilemeZamanlayici.current);
    };
    // sadece senkron ilerleyince (kalan sayi degisince) tetiklenir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncProgress.remaining]);

  const htFtSayilari = useMemo(() => {
    const counts: Partial<Record<HtFtFilter, number>> = {
      ALL: fixtures.length,
    };
    for (const f of fixtures) {
      if (f.htFtResult) {
        counts[f.htFtResult] = (counts[f.htFtResult] ?? 0) + 1;
      }
    }
    return counts;
  }, [fixtures]);

  const filtrelenmisMaclar = useMemo(() => {
    if (filter === 'ALL') return fixtures;
    return fixtures.filter((f) => f.htFtResult === filter);
  }, [fixtures, filter]);

  /** Maclari hafta bazinda kumeler: yeni hafta uste, hafta icinde yeni mac uste. */
  const haftaBolumleri = useMemo(() => {
    const byWeek = new Map<number, Fixture[]>();
    for (const fixture of filtrelenmisMaclar) {
      const week = Number(/(\d+)/.exec(fixture.league.round ?? '')?.[1] ?? 0);
      if (!byWeek.has(week)) byWeek.set(week, []);
      byWeek.get(week)!.push(fixture);
    }

    return [...byWeek.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([week, data]) => {
        data.sort((a, b) => Date.parse(b.fixture.date) - Date.parse(a.fixture.date));
        const range = formatAralik(data[data.length - 1].fixture.date, data[0].fixture.date);
        return {
          title: week > 0 ? `Hafta ${week}` : 'Hafta -',
          range,
          count: data.length,
          data,
        };
      });
  }, [filtrelenmisMaclar]);

  const renderMatch = useCallback(
    ({ item }: { item: Fixture }) => (
      <MatchCard fixture={item} leagueId={leagueId} season={season} />
    ),
    [leagueId, season],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string; range: string; count: number } }) => (
      <View style={styles.haftaAyraci}>
        <Text style={styles.haftaText}>{section.title}</Text>
        <Text style={styles.haftaAralik}>
          {section.range} · {section.count} maç
        </Text>
        <View style={styles.haftaHat} />
      </View>
    ),
    [],
  );

  const keyExtractor = useCallback(
    (f: Fixture) => String(f.fixture.id),
    [],
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1A73E8" />
        <Text style={styles.statusText}>Maclar yukleniyor…</Text>
      </View>
    );
  }

  if (bos) {
    return (
      <View style={styles.centered}>
        <Text style={styles.bosText}>
          {takimId != null
            ? 'Bu takim icin mac bulunamadi.'
            : 'Bu sezon icin veri cekmek mumkun olmadi.'}
        </Text>
        <Text style={styles.bosAltText}>Baska bir sezon deneyin.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterWrapper}>
        <HtFtFilterBar selected={filter} onSelect={setFilter} counts={htFtSayilari} />
      </View>
      <View style={styles.matchList}>
        <SectionList
          sections={haftaBolumleri}
          keyExtractor={keyExtractor}
          renderItem={renderMatch}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                Bu filtreye uygun mac bulunamadi.
              </Text>
            </View>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F6FA',
    gap: 10,
  },
  statusText: {
    fontSize: 15,
    color: '#666',
  },
  bosText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#888',
    textAlign: 'center',
  },
  bosAltText: {
    fontSize: 14,
    color: '#AAA',
    marginTop: 4,
  },
  filterWrapper: {},
  matchList: {
    flex: 1,
  },
  haftaAyraci: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#E8EEF9',
  },
  haftaHat: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#B8C4DD',
  },
  haftaText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1A73E8',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  haftaAralik: {
    fontSize: 11,
    color: '#7A8599',
    fontWeight: '500',
  },
  list: {
    paddingTop: 0,
    paddingBottom: 24,
  },
  emptyContainer: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#999',
  },
});