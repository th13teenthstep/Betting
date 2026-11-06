import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AnalizStackParamList } from '../types/football';
import { fetchUpcomingFixtures, type UpcomingFixture } from '../services/analysisApi';
import { describeApiError } from '../services/thestatsapi';
import ApiLoadingBar from '../components/ApiLoadingBar';
import SyncProgressBar from '../components/SyncProgressBar';
import { useSyncProgress } from '../hooks/useSyncProgress';
import { enrichLeagueCurrentSeason } from '../services/fileLeagueEnrich';

type Nav = NativeStackNavigationProp<AnalizStackParamList, 'AnalizTeams'>;
type Route = RouteProp<AnalizStackParamList, 'AnalizTeams'>;

const AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
function kisaTarih(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()} ${AYLAR[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface TeamRow {
  name: string;
  fixtures: UpcomingFixture[];
}

/** Analiz – 2. adim: liginin onumuzdeki maclarindaki takimlar; takim sec. */
export default function AnalizTeamsScreen() {
  const navigation = useNavigation<Nav>();
  const { leagueId, leagueName } = useRoute<Route>().params;

  const [fixtures, setFixtures] = useState<UpcomingFixture[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    setFixtures(null);
    setHata(null);
    try {
      setFixtures(await fetchUpcomingFixtures(leagueId));
    } catch (e) {
      setHata(describeApiError(e));
    }
  }, [leagueId]);

  useEffect(() => {
    yukle();
  }, [yukle]);

  // IY/oran verisi dosyada eksik olan liglerde (Cin, Japonya, MLS...) bu sezonun eksiklerini
  // arka planda API'den tamamlar; ilerleme cubugu ust kisimda gorunur.
  const sync = useSyncProgress();
  const [enrichErr, setEnrichErr] = useState<string | null>(null);
  useEffect(() => {
    setEnrichErr(null);
    enrichLeagueCurrentSeason(leagueId).catch((e) => setEnrichErr(describeApiError(e)));
  }, [leagueId]);

  const withBar = (node: React.ReactNode) => (
    <View style={styles.screen}>
      <SyncProgressBar state={sync} />
      {enrichErr ? (
        <Text style={styles.enrichErr}>Eksik veriler tamamlanamadı: {enrichErr}</Text>
      ) : null}
      {node}
    </View>
  );

  const teams = useMemo<TeamRow[]>(() => {
    const map = new Map<string, UpcomingFixture[]>();
    for (const f of fixtures ?? []) {
      for (const name of [f.homeName, f.awayName]) {
        if (!map.has(name)) map.set(name, []);
        map.get(name)!.push(f);
      }
    }
    return [...map.entries()]
      .map(([name, list]) => ({
        name,
        fixtures: list.sort((a, b) => Date.parse(a.utcDate) - Date.parse(b.utcDate)).slice(0, 2),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [fixtures]);

  if (hata) {
    return (
      <View style={styles.center}>
        <Text style={styles.errTitle}>Maçlar alınamadı</Text>
        <Text style={styles.errText}>{hata}</Text>
        <TouchableOpacity style={styles.retry} onPress={yukle}>
          <Text style={styles.retryText}>Tekrar dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (fixtures === null) {
    return withBar(
      <>
        <ApiLoadingBar visible title="Fikstür sunucudan alınıyor…" />
        <Text style={styles.hint2}>
          Aynı lig için veri bir kez indirilir, sonraki açılışlarda önbellekten gelir.
        </Text>
      </>,
    );
  }

  if (teams.length === 0) {
    return withBar(
      <View style={styles.center}>
        <Text style={styles.errTitle}>Yaklaşan maç yok</Text>
        <Text style={styles.errText}>{leagueName} için planlanmış maç bulunamadı (sezon arası olabilir).</Text>
      </View>,
    );
  }

  return withBar(
    <FlatList
      style={styles.screen}
      data={teams}
      keyExtractor={(t) => t.name}
      contentContainerStyle={styles.list}
      ListHeaderComponent={<Text style={styles.header}>Bir takım seçin</Text>}
      renderItem={({ item }) => {
        const next = item.fixtures[0];
        const rakip = next.homeName === item.name ? `${next.awayName} (E)` : `${next.homeName} (D)`;
        return (
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.6}
            onPress={() =>
              navigation.navigate('AnalizDetail', {
                leagueId,
                leagueName,
                teamName: item.name,
                fixtures: item.fixtures,
              })
            }
          >
            <View style={styles.rowText}>
              <Text style={styles.team}>{item.name}</Text>
              <Text style={styles.next} numberOfLines={1}>
                Sıradaki: {rakip} · {kisaTarih(next.utcDate)}
              </Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        );
      }}
    />,
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F6FA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10, backgroundColor: '#F5F6FA' },
  enrichErr: { fontSize: 12, color: '#C62828', paddingHorizontal: 16, paddingVertical: 6 },
  hint2: { fontSize: 12, color: '#888', paddingHorizontal: 16, textAlign: 'center' },
  errTitle: { fontSize: 17, fontWeight: '700', color: '#555' },
  errText: { fontSize: 14, color: '#888', textAlign: 'center' },
  retry: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: '#1A73E8' },
  retryText: { color: '#FFF', fontWeight: '700' },
  list: { paddingBottom: 30 },
  header: { fontSize: 13, color: '#666', paddingHorizontal: 14, paddingVertical: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 8,
    marginVertical: 2,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  rowText: { flex: 1 },
  team: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  next: { fontSize: 12, color: '#777', marginTop: 2 },
  arrow: { fontSize: 22, color: '#BBB' },
});
