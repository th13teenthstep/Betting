import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList, Standing } from '../types/football';
import { fetchStandings, clearCache } from '../services/api';
import StandingsTable from '../components/StandingsTable';
import HtFtResultsView from './HtFtResultsView';
import FixtureView from './FixtureView';
import SeasonPicker from '../components/SeasonPicker';
import SyncProgressBar from '../components/SyncProgressBar';
import { useSyncProgress } from '../hooks/useSyncProgress';

// Dosya kaynakli ligler 2012'ye kadar gidiyor; sezon bulunmayan yillarda
// ekran zaten "veri cekmek mumkun olmadi" uyarisini gosteriyor.
const KULLANILABILIR_SEZONLAR = Array.from({ length: 15 }, (_, i) => 2026 - i);

type Route = RouteProp<RootStackParamList, 'LeagueDetail'>;
type Sekme = 'puanDurumu' | 'sonuclar' | 'fikstur';

export default function LeagueDetailScreen() {
  const route = useRoute<Route>();
  const { leagueId, season: routeSeason } = route.params;

  const [season, setSeason] = useState(routeSeason);
  const [activeTab, setActiveTab] = useState<Sekme>('puanDurumu');

  const [standings, setStandings] = useState<Standing[]>([]);
  const [standingsLoading, setStandingsLoading] = useState(true);
  const [standingsBos, setStandingsBos] = useState(false);

  const syncProgress = useSyncProgress();

  useEffect(() => {
    let iptalEdildi = false;

    clearCache(leagueId, season);

    async function yukle() {
      setStandingsLoading(true);
      setStandingsBos(false);
      try {
        const data = await fetchStandings(leagueId, season);
        if (iptalEdildi) return;
        const liste = data.standings[0] ?? [];
        setStandings(liste);
        if (liste.length === 0) setStandingsBos(true);
      } catch (err: unknown) {
        if (iptalEdildi) return;
        setStandingsBos(true);
      } finally {
        if (!iptalEdildi) setStandingsLoading(false);
      }
    }

    yukle();

    return () => {
      iptalEdildi = true;
    };
  }, [leagueId, season]);

  return (
    <View style={styles.screen}>
      {/* Fikstur her zaman guncel haftalari gosterir; sezon secimi anlamsiz */}
      {activeTab !== 'fikstur' && (
        <View style={styles.seasonBar}>
          <SeasonPicker
            selected={season}
            seasons={KULLANILABILIR_SEZONLAR}
            onSelect={setSeason}
          />
        </View>
      )}

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'puanDurumu' && styles.tabActive]}
          onPress={() => setActiveTab('puanDurumu')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'puanDurumu' && styles.tabTextActive,
            ]}
          >
            Puan Durumu
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'sonuclar' && styles.tabActive]}
          onPress={() => setActiveTab('sonuclar')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'sonuclar' && styles.tabTextActive,
            ]}
          >
            Sonuclar & IY/MS
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'fikstur' && styles.tabActive]}
          onPress={() => setActiveTab('fikstur')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'fikstur' && styles.tabTextActive,
            ]}
          >
            Fikstür
          </Text>
        </TouchableOpacity>
      </View>

      <SyncProgressBar state={syncProgress} />

      <View style={styles.content}>
        {activeTab === 'fikstur' ? (
          <FixtureView leagueId={leagueId} />
        ) : activeTab === 'puanDurumu' ? (
          standingsLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#1A73E8" />
              <Text style={styles.statusText}>Puan durumu yukleniyor…</Text>
            </View>
          ) : standingsBos ? (
            <View style={styles.centered}>
              <Text style={styles.bosText}>
                Bu sezon icin veri cekmek mumkun olmadi.
              </Text>
              <Text style={styles.bosAltText}>
                Baska bir sezon deneyin.
              </Text>
            </View>
          ) : (
            <StandingsTable standings={standings} />
          )
        ) : (
          <HtFtResultsView leagueId={leagueId} season={season} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  seasonBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#1A73E8',
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDD',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#1A73E8',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  tabTextActive: {
    color: '#1A73E8',
  },
  content: {
    flex: 1,
  },
});